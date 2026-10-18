# Image prompts for the round-5 content (20 itineraries + 10 countries)

30 images. Save each one with **exactly** the file name shown, then tell Claude to run
`python3 scripts/apply_new_images.py` (it wires them in and loads them; nothing else to edit).

- Itinerary images go in `public/itineraries/<slug>.jpg`
- Country images go in `public/countries/<slug>.jpg`

## Format (same for all 30)

- **1600 x 600 px, JPG** (8:3 panorama; the existing `category-*.jpg` and `scene-*.jpg` use this size).
  Keep each file under ~400 KB (compress to quality ~80).
- The picture is shown three ways: a short card strip on /explore, a wide banner on the itinerary page
  (about 3.8:1, so the top and bottom get cropped) and, for countries, a banner above the guide. **Keep the
  subject in the middle horizontal band** and leave sky/foreground to be cropped.
- The whole site is dark UI: slightly rich, not washed-out, images look best. No white borders.

## Style block (paste at the end of every prompt)

> Photorealistic travel photograph, professional landscape photography, natural light, rich but natural
> colour, sharp detail, wide panoramic composition 8:3 (1600x600), subject centred in the middle band, no
> people in close-up and no recognisable faces, no text, no signs with readable words, no logos, no
> watermark, no border, not an illustration, not a painting, no HDR glow.

Rules that keep this honest (the site's rule is "never fabricate"): each prompt names a **real, specific place
that the itinerary actually visits**. After generating, check the picture really looks like that place
(right dome, right coastline, right rock colour). If the generator invents a landmark, regenerate.
Do not use a generic "city" image for a named place.

---

## Itineraries (20)

### 1. `public/itineraries/paris-loire-valley-chateaux-france.jpg`
The Château de Chenonceau, its white gallery arching across the River Cher, seen from the riverbank in early
morning light with soft mist on the water and tall poplars, Loire Valley, France, late spring.

### 2. `public/itineraries/provence-the-french-riviera-france.jpg`
The Calanques near Marseille: a turquoise cove between pale white limestone cliffs with pine trees on top and a
few small boats at anchor, Mediterranean sea, clear morning sun, France.

### 3. `public/itineraries/rome-florence-venice-by-rail-italy.jpg`
A Venetian canal at golden hour: an arched stone bridge, terracotta-and-ochre palazzo façades, a gondola
moored in the foreground and the dome of Santa Maria della Salute glowing in the distance, Venice, Italy.

### 4. `public/itineraries/naples-pompeii-capri-the-amalfi-coast-italy.jpg`
Positano on the Amalfi Coast: pastel houses stacked down a steep cliff to the sea, a majolica-tiled church dome,
deep blue water and a lemon tree branch softly in the foreground, early evening light, Italy.

### 5. `public/itineraries/madrid-toledo-seville-granada-spain.jpg`
The Alhambra in Granada at sunset: the red fortress walls and towers with the snow-capped Sierra Nevada behind
them and the white houses of the Albaicín below, warm light, Spain.

### 6. `public/itineraries/barcelona-valencia-mallorca-spain.jpg`
The towers of the Sagrada Família rising into a clear blue sky, seen from a nearby park with tree canopy at
the edges, mid-morning light, Barcelona, Spain.

### 7. `public/itineraries/lisbon-sintra-porto-douro-valley-by-train-portugal.jpg`
The Douro Valley in autumn: terraced vineyards stepping down to a wide, calm river, a small whitewashed
quinta among the vines, soft golden light, northern Portugal.

### 8. `public/itineraries/alentejo-algarve-by-train-portugal.jpg`
Ponta da Piedade near Lagos: golden limestone sea stacks and arches rising from emerald water, a small
wooden boat below, late afternoon sun, Algarve, Portugal.

### 9. `public/itineraries/athens-delphi-nafplio-greece.jpg`
The Parthenon on the Acropolis in Athens in warm late-afternoon light, seen from below with olive and pine
trees at the edges and a clear sky, Greece.

### 10. `public/itineraries/paros-naxos-santorini-greece.jpg`
Oia on Santorini at sunset: white cave houses and blue-domed churches along the caldera rim, deep blue
Aegean and a distant volcanic island, soft pink-orange sky, Greece.

### 11. `public/itineraries/london-bath-oxford-england.jpg`
The Radcliffe Camera and the spires of Oxford's old colleges on a soft overcast English morning, honey-coloured
stone, a bit of green lawn in the foreground, England. (Oxford is the iconic skyline here: do not draw Big Ben.)

### 12. `public/itineraries/edinburgh-scottish-highlands-isle-of-skye-scotland.jpg`
The Old Man of Storr on the Isle of Skye: the dark basalt pinnacle above a green hillside, low moody cloud
with a break of light, a glimpse of loch far below, Scotland.

### 13. `public/itineraries/vancouver-whistler-banff-to-jasper-canada.jpg`
Moraine Lake in the Canadian Rockies at sunrise: intensely turquoise water, a rocky foreground and the jagged
Valley of the Ten Peaks with the first light on the summits, Alberta, Canada.

### 14. `public/itineraries/toronto-niagara-montreal-quebec-city-canada.jpg`
Québec City's Château Frontenac hotel on the cliff above the St. Lawrence River and the lower town's stone
rooftops, golden hour, a few autumn-coloured trees, Canada.

### 15. `public/itineraries/sydney-melbourne-the-great-ocean-road-australia.jpg`
The Twelve Apostles limestone stacks off the Great Ocean Road in Victoria, rolling surf at their base, late
golden light on the cliffs, a dramatic sky, Australia.

### 16. `public/itineraries/red-centre-way-alice-springs-kings-canyon-uluru-australia.jpg`
Uluru at sunset: the great red monolith glowing orange-red on the flat desert plain, dry scrub and red sand in
the foreground, a clear sky fading to purple, Northern Territory, Australia.

### 17. `public/itineraries/cape-town-winelands-garden-route-south-africa.jpg`
Table Mountain with its flat top and a thin "tablecloth" of cloud above Cape Town and Table Bay, seen from
across the water at golden hour, South Africa.

### 18. `public/itineraries/johannesburg-kruger-national-park-south-africa.jpg`
Kruger National Park savanna at dawn: a small elephant herd walking across open golden grassland with
flat-topped acacia trees and soft haze, South Africa. (Distant animals, no close-up faces.)

### 19. `public/itineraries/seoul-dmz-gyeongju-busan-south-korea.jpg`
Gyeongbokgung Palace in Seoul: the ornate Geunjeongjeon hall with its tiered roof and painted eaves, stone
courtyard, and the green mountain Bugaksan behind it, clear autumn light, South Korea.

### 20. `public/itineraries/jeju-island-jeonju-south-korea.jpg`
Seongsan Ilchulbong ("Sunrise Peak") on Jeju Island: the green volcanic crater rim rising from the sea
on a narrow isthmus, calm ocean, soft morning light, South Korea.

---

## Country guides (10)

These get a new banner above the country guide heading, so they should feel like the country, not one place.
Use a landscape that is unmistakably that country.

### 21. `public/countries/france.jpg`
A lavender field in Provence at golden hour with a stone farmhouse and a row of cypress trees, soft hills
beyond, France.

### 22. `public/countries/italy.jpg`
Tuscan hills at dawn: rolling green and gold fields, a line of cypress trees along a winding white road and a
stone farmhouse, low mist, Italy.

### 23. `public/countries/spain.jpg`
The white village of Frigiliana in Andalusia: whitewashed houses with terracotta roofs climbing a hillside
under a deep blue sky, flowers on the balconies, Spain.

### 24. `public/countries/portugal.jpg`
The yellow trams and terracotta rooftops of Lisbon's Alfama quarter at golden hour, with the Tagus River
glinting beyond, Portugal.

### 25. `public/countries/greece.jpg`
A quiet Cycladic harbour: whitewashed houses with blue shutters around a small bay with fishing boats, a
windmill on the hill, strong afternoon sun and deep blue sea, Greece.

### 26. `public/countries/uk.jpg`
The green rolling hills of the Cotswolds with a honey-stone village and a dry-stone wall in the foreground,
soft English light and scattered cloud, United Kingdom.

### 27. `public/countries/canada.jpg`
A calm mountain lake in the Canadian Rockies reflecting snow-capped peaks and dark evergreen forest, wooden
dock in the foreground, clear early-morning light, Canada.

### 28. `public/countries/australia.jpg`
The Sydney Opera House and Harbour Bridge across calm blue harbour water at golden hour, a ferry crossing the
foreground, soft sky, Australia.

### 29. `public/countries/south-korea.jpg`
A traditional Korean hanok village: curved dark-tile roofs along a gentle hillside street in autumn light, ginkgo
trees turning yellow, Jeonju Hanok Village, South Korea.

### 30. `public/countries/south-africa.jpg`
Cape Point and the rugged coastline of the Cape Peninsula: rocky headland meeting a turquoise-blue Atlantic, a
lighthouse high on the ridge and fynbos in the foreground, South Africa.

---

## After saving the files

```bash
python3 scripts/apply_new_images.py            # lists what it found/missed, wires covers + country banners
python3 scripts/apply_new_images.py --check    # only report what is missing, change nothing
```

Then Claude loads the covers into the database and deploys. Files that are missing keep the generic category
image, so you can do this in batches.
