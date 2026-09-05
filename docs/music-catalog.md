# Party playlist metadata

BunăSpritz folosește API-ul public HTTP Deezer doar pentru metadata de melodii și coveruri. Nu există playback, streaming, download sau stocare audio.

## Adapter

- API: `GET https://api.deezer.com/search?q={query}`
- intern: `searchMusic(query)` in `lib/music.ts` / `lib/music.web.ts`
- răspuns: JSON Deezer, lista din `data`
- modelul intern folosește ID-ul Deezer ca identificator principal;
- titlul, artistul, albumul, durata, anul, explicit, `previewUrl` și `trackUrl` sunt extrase din rezultatul Deezer.

## Browser/native

Native iOS/Android folosește `fetch()` direct către `https://api.deezer.com/search`. Expo Web folosește proxy-ul local `GET http://localhost:3002/api/music/search?q=...`, configurabil cu `EXPO_PUBLIC_DEEZER_PROXY_URL`, deoarece Deezer nu permite consumul direct din Chrome prin CORS. Proxy-ul acceptă numai search, validează query-ul, limitează lungimea și face un singur request upstream fix către `api.deezer.com`; nu acceptă URL-uri arbitrare. UI-ul este provider-agnostic și consumă numai `SongCatalogItem`.

## Cache and request control

Search-ul este debounced 400ms în editor și începe după minimum 2 caractere. Rezultatele sunt cache-uite în memorie după query normalizat. Rezultatele sunt deduplicate după ID Deezer, iar răspunsurile vechi nu suprascriu query-ul curent. Adapterul nu execută requesturi pentru fiecare caracter, astfel utilizarea normală rămâne sub limita Deezer de 50 requesturi / 5 secunde.

## Covers

Coverurile sunt luate din cel mai mare URL disponibil în răspunsul Deezer: `album.cover_xl`, apoi `album.cover_big`, apoi `album.cover_medium`. Dacă lipsesc, UI-ul folosește `MusicCoverPlaceholder`. Nu se folosesc MusicBrainz, Cover Art Archive, Google Images sau scraping.

## Error handling

Dacă Deezer nu este disponibil, editorul afișează eroarea controlată, păstrează melodiile selectate și permite fallback-ul manual. Căutarea nu blochează crearea sau editarea evenimentului.
