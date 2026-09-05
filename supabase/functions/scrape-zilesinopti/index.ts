// Periodically pulls "Party" events out of https://zilesinopti.ro/evenimente-brasov/
// and adds the ones that actually involve alcohol as events in the app — with
// a distinct emoji/color (source = 'scraper') so they read as
// auto-discovered rather than host-created. Triggered on a schedule by
// pg_cron (see the schedule_scrape_zilesinopti migration); not reachable by
// end users (verify_jwt is off, but the x-cron-secret header stands in).
import { adminClient } from '../_shared/push.ts';

const LISTING_URL = 'https://zilesinopti.ro/evenimente-brasov/';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const SCRAPER_UA = 'Mozilla/5.0 (compatible; SpritzAppBot/1.0; +party-alcohol-event-scraper)';

// Piața Sfatului, Brașov — used only when Gemini couldn't extract a venue
// specific enough to geocode, so the event still shows up rather than being
// silently dropped.
const BRASOV_FALLBACK = { lng: 25.5887, lat: 45.6427 };

// Deliberately different from any default a host picks in new-event.tsx —
// this pair of emoji + color is the whole "different icon" story: both map
// renderers (MapboxMap.tsx / .web.tsx) already key a pin's look purely off
// event.emoji + event.color, so no marker-rendering code needs to change.
const SCRAPER_EMOJI = '🍾';
const SCRAPER_COLOR = '#8B5CF6';

const PAST_EVENT_GRACE_MS = 24 * 60 * 60 * 1000;
const UNDATED_EVENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_STARTS_AT_DRIFT_DAYS = 200;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’');
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

type ListingItem = { title: string; link: string; slug: string; category: string };

function parseListing(html: string): ListingItem[] {
  // Every event card is a `<div class='kzn-sw-item'>...</div>`; splitting on
  // the opening marker and only searching the first slice of each fragment
  // keeps a field match from ever crossing into the next card.
  const fragments = html.split(/kzn-sw-item['"]/i).slice(1);
  const items: ListingItem[] = [];
  for (const fragment of fragments) {
    const chunk = fragment.slice(0, 3000);
    const category = extractField(chunk, 'kzn-sw-item-textsus');
    const titleLink = extractLink(chunk, 'kzn-sw-item-titlu');
    if (!category || !titleLink) continue;
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
  // a tag boundary — slicing from there leaks that raw attribute text past
  // stripTags (it only strips things that start with `<`). Slicing from the
  // next tag open instead keeps everything well-formed.
  const idx = html.indexOf('<div', markerIdx);
  if (idx === -1) return '';
  const chunk = html.slice(idx, idx + 6000).replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return cleanText(chunk).slice(0, 4000);
}

type GeminiVerdict = { alcohol: boolean; venue: string | null; starts_at_iso: string | null; reason: string };

async function classifyEvent(apiKey: string, title: string, description: string): Promise<GeminiVerdict> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Ești un asistent care analizează un eveniment de tip "petrecere" (party) din Brașov, România, pentru o aplicație de social/evenimente.

Titlu: ${title}
Descriere: ${description}

Astăzi este ${today}. Răspunde STRICT cu un obiect JSON (fără text în plus, fără markdown), cu exact aceste chei:
{"alcohol": true sau false, "venue": string sau null, "starts_at_iso": string sau null, "reason": string}

Reguli:
- "alcohol": true DOAR dacă textul menționează clar băuturi alcoolice sau ceva ce le implică direct (bar, bere, vin, cocktailuri, șampanie, "open bar", "drinkuri", petrecere într-un club/bar etc). Dacă nu e clar sau textul sugerează un eveniment fără alcool (ex: petrecere pentru copii, eveniment religios, eveniment "family friendly" explicit), pune false.
- "venue": numele exact al locației menționate în text (ex. "ORCA SMASH, La Metrom, Brașov"), sau null dacă nu apare nicio locație specifică (nu pune doar "Brașov").
- "starts_at_iso": data și ora de start, format ISO 8601 cu ora locală a României, ex "2026-09-05T20:00:00+03:00". Dacă anul lipsește din text, alege anul curent sau următorul, oricare rezultă într-o dată în viitor față de azi. Dacă nu poți determina o dată/oră, pune null.
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

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('forbidden', { status: 403 });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) return new Response('missing GEMINI_API_KEY secret', { status: 500 });

  const admin = adminClient();

  // Keep the map tidy: drop scraped events whose party has already happened,
  // and undated scraped events that have sat around unresolved too long.
  // Host-created events are never touched (both deletes are source='scraper' only).
  await admin
    .from('events')
    .delete()
    .eq('source', 'scraper')
    .not('starts_at', 'is', null)
    .lt('starts_at', new Date(Date.now() - PAST_EVENT_GRACE_MS).toISOString());
  await admin
    .from('events')
    .delete()
    .eq('source', 'scraper')
    .is('starts_at', null)
    .lt('created_at', new Date(Date.now() - UNDATED_EVENT_TTL_MS).toISOString());

  const listingRes = await fetch(LISTING_URL, { headers: { 'User-Agent': SCRAPER_UA } });
  if (!listingRes.ok) return new Response(`failed to fetch listing page: ${listingRes.status}`, { status: 502 });
  const listingHtml = await listingRes.text();

  const partyItems = parseListing(listingHtml).filter((item) => item.category.toLowerCase() === 'party');
  const slugs = partyItems.map((item) => item.slug);

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
  const candidates = [...new Map(partyItems.map((item) => [item.slug, item])).values()].filter(
    (item) => !alreadyHandled.has(item.slug)
  );

  let imported = 0;
  let rejected = 0;
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

      const venue = verdict.venue?.trim();
      const geo = venue ? await geocode(`${venue}, Brașov, România`) : null;
      const coords = geo ?? BRASOV_FALLBACK;

      const detailLines = [truncateAtWord(description, 500)];
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
        genre: 'Party',
        starts_at: resolveStartsAt(verdict.starts_at_iso),
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
    JSON.stringify({ partyItemsFound: partyItems.length, candidates: candidates.length, imported, rejected, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
