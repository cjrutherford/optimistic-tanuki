# S10 Social town coordinates

Task: compare every city and town in `apps/social/src/data/seed-cities.json` (263 entries; the Local Hub copy is identical) with the 2026 Census Gazetteer places file (INTPTLAT/INTPTLONG, matched by name and state) and, for the 258 towns with an installed Directory boundary, with that boundary (read-only PostGIS `ST_Intersects` on the latest `directory_town_geometry` version, joined by the live Social community id).

Neighbourhood entries are not corrected. Their coordinates are generated and unrelated to the parent city, but the Directory does not match borders for them.

## Corrected coordinates (13)

Each new point is the Census 2026 Gazetteer internal point, rounded to four decimals, and was checked to fall inside the town's installed boundary. "Outside boundary" is the distance from the old point to the boundary edge.

| Slug             | Old lat, lng      | New lat, lng      | Moved     | Outside boundary |
| ---------------- | ----------------- | ----------------- | --------- | ---------------- |
| gainesville-ga   | 34.2979, -83.9879 | 34.2901, -83.8291 | 14.6 km   | 8.4 km           |
| fripp-island-sc  | 32.3468, -80.5632 | 32.3203, -80.484  | 8.0 km    | 6.1 km           |
| mccormick-sc     | 33.978, -82.294   | 33.9124, -82.289  | 7.3 km    | 5.7 km           |
| cedar-key-fl     | 29.1464, -82.8023 | 29.1503, -83.0374 | 22.8 km   | 21.7 km          |
| hatteras-nc      | 35.6935, -75.6902 | 35.2212, -75.6849 | 52.5 km   | 50.8 km          |
| kerrville-tx     | 30.0375, -98.9012 | 30.0383, -99.1311 | 22.1 km   | 16.8 km          |
| seat-pleasant-md | 38.8143, -76.9122 | 38.8947, -76.8995 | 9.0 km    | 8.1 km           |
| falls-church-va  | 38.8855, -77.3001 | 38.8847, -77.1756 | 10.8 km   | 9.2 km           |
| wethersfield-ct  | 41.5832, -72.6508 | 41.7026, -72.6697 | 13.4 km   | 9.8 km           |
| seguin-tx        | 29.5689, -77.945  | 29.5902, -97.9686 | 1933.9 km | 1924.6 km        |
| poteet-tx        | 29.0369, -98.6285 | 29.038, -98.5714  | 5.6 km    | 4.1 km           |
| camilla-ga       | 31.1355, -84.192  | 31.2341, -84.2096 | 11.1 km   | 8.1 km           |
| lake-park-ga     | 30.6838, -82.9961 | 30.6856, -83.1877 | 18.3 km   | 16.9 km          |

## Population

| Slug            | Old   | New   | Source                                                                                                       |
| --------------- | ----- | ----- | ------------------------------------------------------------------------------------------------------------ |
| edisto-beach-sc | 775   | 1031  | Census 2020 base (Vintage 2025 estimates file, ESTIMATESBASE2020); 2025 estimate is 1071                     |
| palm-valley-fl  | 20019 | 21827 | 2020 Census count for the Palm Valley CDP, read from Wikipedia's citation of it (the Census API needs a key) |

Edisto Beach and Palm Valley coordinates already match the Gazetteer (under 0.1 km) and sit inside their boundaries, so they are unchanged.

## Checked and kept

Entries more than 5 km from the Gazetteer point but inside their boundary were left alone. These are city-centre points where the Gazetteer internal point is skewed by annexed land or water: Corpus Christi, Panama City, Columbia, Savannah, Palm Bay, Cape Coral, Orlando, Fayetteville and similar. Medina TX matched the wrong Gazetteer place (Medina CDP in Starr County); the seed point is in Bandera County and the entry was merged into Bandera (D25).

## Rollout

On deploy the Social seed skips unchanged rows and compares coordinates at decimal(9,6). The 13 changed coordinates (and two populations) update, and each emits a Directory change for its town only. The Directory then re-matches those towns' borders.
