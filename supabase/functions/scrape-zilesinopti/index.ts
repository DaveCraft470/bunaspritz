// Periodically pulls events out of zilesinopti.ro's Brașov listings (the
// dedicated party-brasov archive, plus every real event on the general
// evenimente-brasov listing) and adds the ones that actually involve alcohol
// as events in the app — with a distinct emoji/color/pin shape (source =
// 'scraper') so they read as auto-discovered rather than host-created.
// Triggered on a schedule by pg_cron (see the schedule_scrape_zilesinopti
// migration); not reachable by end users (verify_jwt is off, but the
// x-cron-secret header stands in).
//
// Deliberately does NOT pre-filter the general listing down to items
// zilesinopti itself tagged "Party" — a beer festival like Oktoberfest gets
// tagged "Festival" there, not "Party", even though it obviously involves
// alcohol. Trusting the site's own taxonomy instead of Gemini's actual
// content classification silently drops exactly the events this scraper
// exists to catch. So every real event (any item with a genuine
// /evenimente/<slug>/ link) is a candidate, and classifyEvent's alcohol
// verdict is the only gate — see its prompt below for why that's still cheap
// (each slug is only ever classified once, cached in scraped_event_checks).
import { adminClient } from '../_shared/push.ts';

// The dedicated Party taxonomy archive for Brașov — every event listed here
// IS a party by definition, even though its own "kzn-sw-item-textsus" tag is
// often a more specific subgenre (e.g. "DJ Set") rather than the literal
// string "Party". Kept as a separate fetch (rather than relying solely on
// the general listing) since it surfaces party listings the general listing
// sometimes doesn't carry yet.
const PARTY_LISTING_URL = 'https://zilesinopti.ro/party-brasov/';
const LISTING_URL = 'https://zilesinopti.ro/evenimente-brasov/';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const SCRAPER_UA = 'Mozilla/5.0 (compatible; SpritzAppBot/1.0; +party-alcohol-event-scraper)';

// Piața Sfatului, Brașov — used only when Gemini couldn't extract a venue
// specific enough to geocode, so the event still shows up rather than being
// silently dropped.
const BRASOV_FALLBACK = { lng: 25.5887, lat: 45.6427 };

// Deliberately different from any default a host picks in new-event.tsx.
// The map pin shape itself is also different for source === 'scraper' (see
// MapboxMap.tsx / .web.tsx / lib/mapboxGlWeb.ts) — this emoji/color pair is
// just what fills that distinct shape, not the whole "different icon" story.
const SCRAPER_EMOJI = '🍾';
const SCRAPER_COLOR = '#8B5CF6';

// Gemini only gives us a start time, never a duration, so this is a heuristic
// for "the party is over" — long enough to cover a typical night-out party,
// short enough that it doesn't linger looking live a full day later.
const PAST_EVENT_GRACE_MS = 6 * 60 * 60 * 1000;
const UNDATED_EVENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_STARTS_AT_DRIFT_DAYS = 200;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function cleanText(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

// Scans forward from an opening `<div ...>` tag to find its matching closing
// `</div>`, tracking nesting depth — the exact content block regardless of
// its size, rather than guessing a fixed byte window (which either cuts the
// article short or, worse, cuts mid-tag/mid-attribute and leaks raw markup —
// e.g. SVG path data from a later share-icon widget — into the stored text).
function extractBalancedDiv(html: string, openTagStart: number): string {
  const openTagEnd = html.indexOf('>', openTagStart);
  if (openTagEnd === -1) return '';
  let depth = 1;
  const tagRe = /<div\b|<\/div>/gi;
  tagRe.lastIndex = openTagEnd + 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    depth += match[0].toLowerCase().startsWith('<div') ? 1 : -1;
    if (depth === 0) return html.slice(openTagEnd + 1, match.index);
  }
  return '';
}

// Pulls the first occurrence of `class="...<name>..."<content></div>` out of
// an HTML fragment. Tailored to this site's markup (a flat div per field,
// no nested divs of the same class) rather than a general HTML parser —
// cheap, dependency-free, and matches what curl-ing the real page showed.
function extractField(chunk: string, className: string): string | null {
  const re = new RegExp(`class=['"][^'"]*\\b${className}\\b[^'"]*['"][^>]*>([\\s\\S]*?)<\\/div>`, 'i');
  const match = chunk.match(re);
  return match ? cleanText(match[1]) : null;
}

function extractLink(chunk: string, className: string): { text: string; href: string } | null {
  const re = new RegExp(
    `class=['"][^'"]*\\b${className}\\b[^'"]*['"][^>]*>[\\s\\S]*?<a[^>]*href=['"]([^'"]+)['"][^>]*>([\\s\\S]*?)<\\/a>`,
    'i'
  );
  const match = chunk.match(re);
  return match ? { href: match[1], text: cleanText(match[2]) } : null;
}

type ListingItem = { title: string; link: string; slug: string; category: string | null };

function parseListing(html: string): ListingItem[] {
  // Every event card is a `<div class='kzn-sw-item'>...</div>`; splitting on
  // the opening marker and only searching the first slice of each fragment
  // keeps a field match from ever crossing into the next card. Category can
  // be missing (e.g. on the party-brasov archive some cards carry no
  // "textsus" tag at all) — callers decide whether that's disqualifying.
  const fragments = html.split(/kzn-sw-item['"]/i).slice(1);
  const items: ListingItem[] = [];
  for (const fragment of fragments) {
    const chunk = fragment.slice(0, 3000);
    const category = extractField(chunk, 'kzn-sw-item-textsus');
    const titleLink = extractLink(chunk, 'kzn-sw-item-titlu');
    if (!titleLink) continue;
    const slugMatch = titleLink.href.match(/\/evenimente\/([^/?#]+)\/?/);
    if (!slugMatch) continue;
    items.push({ title: titleLink.text, link: titleLink.href, slug: slugMatch[1], category });
  }
  return items;
}

// The detail page's main WordPress post-content block has the real
// description (the listing's own summary is often just the title repeated).
async function fetchDetailText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': SCRAPER_UA } });
  if (!res.ok) return '';
  const html = await res.text();
  const marker = 'theme-post-content.default';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return '';
  // The marker sits inside a `data-widget_type="..."` attribute value, not at
  // a tag boundary — starting from there leaks that raw attribute text past
  // stripTags (it only strips things that start with `<`). Starting from the
  // next tag open instead keeps everything well-formed.
  const idx = html.indexOf('<div', markerIdx);
  if (idx === -1) return '';
  const raw = extractBalancedDiv(html, idx);
  const chunk = raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  return truncateAtWord(cleanText(chunk), 4000);
}

type GeminiVerdict = {
  alcohol: boolean;
  venue: string | null;
  starts_at_iso: string | null;
  ends_at_iso: string | null;
  reason: string;
};

async function classifyEvent(apiKey: string, title: string, description: string): Promise<GeminiVerdict> {
  const today = new Date().toISOString().slice(0, 10);
  // Deliberately NOT scoped to "petrecere/party" — the candidate pool now
  // includes every event type on the listing (concerts, festivals, theatre,
  // ...), and it's this alcohol verdict alone that decides whether something
  // belongs in the app. A beer/wine festival (e.g. Oktoberfest) is exactly
  // the kind of event that must score alcohol:true here even though nothing
  // about it looks like a nightclub party.
  const prompt = `Ești un asistent care analizează un eveniment din Brașov, România (poate fi petrecere, festival, concert, degustare, târg etc.), pentru o aplicație de social/evenimente axată pe ieșiri unde se consumă băuturi alcoolice.

Titlu: ${title}
Descriere: ${description}

Astăzi este ${today}. Răspunde STRICT cu un obiect JSON (fără text în plus, fără markdown), cu exact aceste chei:
{"alcohol": true sau false, "venue": string sau null, "starts_at_iso": string sau null, "ends_at_iso": string sau null, "reason": string}

Reguli:
- "alcohol": true dacă textul menționează clar băuturi alcoolice sau ceva ce le implică direct — nu doar petreceri de club: bar, bere, vin, cocktailuri, șampanie, "open bar", "drinkuri", festival de bere/vin (ex. Oktoberfest, festival al vinului), degustare de bere/vin, food truck festival cu bere la halbă etc. Dacă nu e clar sau textul sugerează un eveniment fără alcool (ex: petrecere pentru copii, eveniment religios, eveniment sportiv, eveniment "family friendly" explicit), pune false.
- "venue": numele exact al locației menționate în text (ex. "ORCA SMASH, La Metrom, Brașov"), sau null dacă nu apare nicio locație specifică (nu pune doar "Brașov").
- "starts_at_iso": data și ora de start, format ISO 8601 cu ora locală a României, ex "2026-09-05T20:00:00+03:00". Dacă anul lipsește din text, alege anul curent sau următorul, oricare rezultă într-o dată în viitor față de azi. Dacă nu poți determina o dată/oră, pune null.
- "ends_at_iso": pentru evenimente pe mai multe zile (festivaluri, târguri), data și ora de final ale ÎNTREGULUI eveniment (nu a unei singure zile), același format ISO 8601. Pentru un eveniment de o singură seară, sau dacă nu poți determina finalul, pune null.
- "reason": o propoziție scurtă în română care explică verdictul pentru "alcohol".`;

  // gemini-flash-latest returns transient 503s under load fairly often in
  // practice — worth a couple of short retries rather than dropping an
  // otherwise-good candidate for a whole 3-hour cron cycle over one blip.
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) throw new Error(`gemini request failed: ${res.status} ${await res.text()}`);

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('gemini response had no text part');
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function geocode(query: string): Promise<{ lng: number; lat: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ro&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SpritzAppEventScraper/1.0 (self-hosted, non-commercial)' } });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const lng = parseFloat(rows[0].lon);
  const lat = parseFloat(rows[0].lat);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  return { lng, lat };
}

function resolveStartsAt(isoCandidate: string | null): string | null {
  if (!isoCandidate) return null;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) return null;
  const driftDays = Math.abs(parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (driftDays > MAX_STARTS_AT_DRIFT_DAYS) return null; // Gemini hallucinated a wild year — drop it rather than trust it.
  return parsed.toISOString();
}

// Only meaningful once a valid start exists, and only kept when it's
// actually after that start — otherwise it's either a single-day event (no
// end given) or a hallucinated one, and startsAt alone already covers both.
function resolveEndsAt(isoCandidate: string | null, startsAtIso: string | null): string | null {
  if (!isoCandidate || !startsAtIso) return null;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) return null;
  const driftDays = Math.abs(parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (driftDays > MAX_STARTS_AT_DRIFT_DAYS) return null;
  if (parsed.getTime() <= new Date(startsAtIso).getTime()) return null;
  return parsed.toISOString();
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('forbidden', { status: 403 });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) return new Response('missing GEMINI_API_KEY secret', { status: 500 });

  const admin = adminClient();

  // Keep the map tidy: drop scraped events that are already over, and undated
  // scraped events that have sat around unresolved too long. Host-created
  // events are never touched (every delete below is source='scraper' only).
  // "Already over" is keyed on ends_at when we have one — a multi-day
  // festival (e.g. Oktoberfest) is very much still on after its first day's
  // starts_at has passed, and this used to delete it mid-run.
  const cutoffIso = new Date(Date.now() - PAST_EVENT_GRACE_MS).toISOString();
  await admin.from('events').delete().eq('source', 'scraper').not('ends_at', 'is', null).lt('ends_at', cutoffIso);
  await admin
    .from('events')
    .delete()
    .eq('source', 'scraper')
    .is('ends_at', null)
    .not('starts_at', 'is', null)
    .lt('starts_at', cutoffIso);
  await admin
    .from('events')
    .delete()
    .eq('source', 'scraper')
    .is('starts_at', null)
    .lt('created_at', new Date(Date.now() - UNDATED_EVENT_TTL_MS).toISOString());

  const [partyListingRes, mixedListingRes] = await Promise.all([
    fetch(PARTY_LISTING_URL, { headers: { 'User-Agent': SCRAPER_UA } }),
    fetch(LISTING_URL, { headers: { 'User-Agent': SCRAPER_UA } }),
  ]);
  if (!partyListingRes.ok) return new Response(`failed to fetch party listing page: ${partyListingRes.status}`, { status: 502 });
  // The general listing is the primary source of breadth now (see the
  // top-of-file note on why it's no longer filtered to category === 'Party'),
  // so a failed fetch here can't be allowed to silently look like "nothing
  // new today" — log it loudly and surface it in the response, but don't
  // fail the whole run: the party archive fetch above still succeeded and is
  // worth processing on its own.
  if (!mixedListingRes.ok) console.error(`failed to fetch mixed listing page: ${mixedListingRes.status}`);

  // Every event on the dedicated party-brasov archive is a party by
  // definition, regardless of its own subgenre tag — no category filtering
  // needed. The general listing carries every event type Brașov has
  // (concerts, theatre, festivals, ...); non-event articles are already
  // excluded by the /evenimente/<slug>/ link requirement in parseListing, and
  // classifyEvent's alcohol verdict below is what actually decides whether an
  // event belongs in the app — not zilesinopti's own category tag.
  const fromPartyArchive = parseListing(await partyListingRes.text());
  const fromMixedListing = mixedListingRes.ok ? parseListing(await mixedListingRes.text()) : [];
  const allItems = [...fromPartyArchive, ...fromMixedListing];
  const slugs = allItems.map((item) => item.slug);

  const [{ data: existingEvents }, { data: existingChecks }] = await Promise.all([
    slugs.length ? admin.from('events').select('external_id').in('external_id', slugs) : Promise.resolve({ data: [] as { external_id: string }[] }),
    slugs.length
      ? admin.from('scraped_event_checks').select('external_id').in('external_id', slugs)
      : Promise.resolve({ data: [] as { external_id: string }[] }),
  ]);
  const alreadyHandled = new Set([
    ...(existingEvents ?? []).map((row) => row.external_id),
    ...(existingChecks ?? []).map((row) => row.external_id),
  ]);
  // The same event routinely shows up in more than one widget on the page
  // (a "featured" strip plus the full listing) with an identical slug — keep
  // just the first occurrence so it isn't fetched/classified twice per run.
  const candidates = [...new Map(allItems.map((item) => [item.slug, item])).values()].filter(
    (item) => !alreadyHandled.has(item.slug)
  );

  let imported = 0;
  let rejected = 0;
  let skippedPast = 0;
  let failed = 0;

  for (const item of candidates) {
    try {
      const description = (await fetchDetailText(item.link)) || item.title;
      const verdict = await classifyEvent(geminiKey, item.title, description);

      if (!verdict.alcohol) {
        await admin.from('scraped_event_checks').insert({ external_id: item.slug, alcohol: false });
        rejected++;
        continue;
      }

      const startsAt = resolveStartsAt(verdict.starts_at_iso);
      const endsAt = resolveEndsAt(verdict.ends_at_iso, startsAt);
      // Gemini sometimes resolves a date that's already passed (e.g. it kept
      // the year mentioned in the text instead of rolling to next year's
      // occurrence) — importing it would just insert an event the very next
      // cleanup pass deletes, flashing a "current" event that's already over.
      // Judged on the actual end for multi-day events (a festival's first day
      // being in the past doesn't mean the festival is over) — see endsAt.
      const effectiveEnd = endsAt ?? startsAt;
      if (effectiveEnd && new Date(effectiveEnd).getTime() < Date.now() - PAST_EVENT_GRACE_MS) {
        await admin.from('scraped_event_checks').insert({ external_id: item.slug, alcohol: true });
        skippedPast++;
        continue;
      }

      const venue = verdict.venue?.trim();
      const geo = venue ? await geocode(`${venue}, Brașov, România`) : null;
      const coords = geo ?? BRASOV_FALLBACK;

      // The full article text (fetchDetailText already caps it at 4000 chars)
      // so that pressing into the event shows the real write-up, not a
      // truncated preview — the source link below is for going even further.
      const detailLines = [description];
      if (!geo) detailLines.push('📍 Locație aproximativă (centrul Brașovului)');
      detailLines.push(`Sursă: zilesinopti.ro`);

      const { error } = await admin.from('events').insert({
        host_id: null,
        title: item.title,
        detail: detailLines.join('\n\n'),
        emoji: SCRAPER_EMOJI,
        color: SCRAPER_COLOR,
        lng: coords.lng,
        lat: coords.lat,
        // zilesinopti's own category tag (e.g. "Festival", "Concerte") now
        // that candidates aren't restricted to "Party" — falls back to
        // "Party" only when a card genuinely carried no tag.
        genre: item.category?.trim() || 'Party',
        starts_at: startsAt,
        ends_at: endsAt,
        entry_fee_ron: null,
        drinks_price_ron: null,
        max_participants: null,
        location_is_rented: null,
        rental_proof_path: null,
        source: 'scraper',
        source_url: item.link,
        external_id: item.slug,
      });

      if (error) {
        // Most likely a race with another concurrent run hitting the same
        // external_id unique index — not worth crashing the whole batch over.
        console.error(`insert failed for ${item.slug}: ${error.message}`);
        failed++;
        continue;
      }

      await admin.from('scraped_event_checks').insert({ external_id: item.slug, alcohol: true });
      imported++;
    } catch (err) {
      console.error(`failed to process ${item.slug}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      itemsFound: allItems.length,
      mixedListingOk: mixedListingRes.ok,
      candidates: candidates.length,
      imported,
      rejected,
      skippedPast,
      failed,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
