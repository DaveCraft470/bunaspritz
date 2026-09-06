# Local drink catalog

The autocomplete catalog is static and bundled in `lib/drinks.ts`. It does not call an external API at runtime and search is performed locally in memory.

The seed is a curated list of real, commonly sold Romanian and international brands/products, based on public product/brand listings and common retail pack sizes. It intentionally excludes obscure or unverifiable products. Volumes are product-level common pack sizes, not inventory claims.

The seed is currently a curated static catalog of 315 real product entries, spanning Romanian retail categories and international products sold in Romania. It includes distinct Florentino variants from Zarea (Vișine, Caise, Afine, Ciocolată, Căpșuni, Piersici, Fructe de pădure, Mentă, Cappuccino, Limoncello and Limonata), plus verified Zarea, Alexandrion and Milcov entries. It includes aliases for diacritics-free and common searches such as `flor`, `florentino`, `visine`, `jager`, `coke`, `captain`, `red bull`, `apa`, `bere`, `tuica` and `palinca`.

The catalog model is product plus `volumesMl`, optional packaging metadata, alcohol-free metadata and optional subcategory. The event list uses `productId + volumeMl` semantics through the selected item's stable `id`, while custom drinks remain event-local and never mutate the global catalog.

## Sources and limits

The static seed was curated from public Romanian retail catalog signals checked on 2026-09-06, especially Carrefour Romania product/search pages and Auchan Romania beverage-category/search pages. Confirmed examples include Florentino Vișine 0.5 L, Alexandrion 5/7/9 Star variants, Milcov Cognac/Brandy, and multiple Zarea sparkling wine/cocktail entries. These pages expose a changing assortment, so this is a practical curated catalog, not a legal or exhaustive inventory snapshot. The app never calls either retailer at runtime.

Open Food Facts is used only as an explicit barcode fallback in `lib/openFoodFacts.ts`. It uses the v3 product endpoint on `world.openfoodfacts.org`, a descriptive User-Agent, timeout/error handling and an in-memory barcode cache. Local autocomplete never calls the network. Full-text online search and camera scanning are intentionally not enabled because the current Expo stack has no barcode scanner dependency and the product endpoint is barcode-based.

Non-consumable alcohol, sanitizing/technical/medicinal alcohol, cleaning products, cosmetics and automotive fluids are deliberately excluded. Exact availability and packaging vary by retailer, region and date; the listed volumes are common product pack sizes and are not an inventory claim.
