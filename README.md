# Volta SKAI 3D apartment explorer

Interactive recreation of the Krulli 10 apartment selector. The project uses
the supplied production GLB, 62 KTX2 textures, environment map, and the complete
130-unit inventory export.

## Run locally

```powershell
cd C:\Users\Waris\Downloads\allocation
node serve.js
```

Open <http://127.0.0.1:8080>. Opening `index.html` directly with `file://` will
not work because browsers block module and model requests from local files.

The first page load needs internet access for Three.js, its Draco decoder, and
the Basis/KTX2 transcoder. The building, textures, environment, and inventory
are all served locally.

## Included behavior

- orbit, constrained zoom, hover and click selection
- production model textures and environment lighting
- real unit prices, statuses, sizes, floors, towers, balconies, types and views
- availability, tower, unit type, room, floor, size, price and view filters
- synchronized model highlighting, result list and unit detail card
- query-driven unit details page with production interior model and labeled floor plan
- exact per-unit production model and texture registry for every live unit page
- sold and redirecting booked units disabled in the apartment explorer
- live floor-plan selector, compass and site-plan modes
- desktop and mobile layouts

`apartments.json` is joined to GLB nodes through `number_num` and node names in
the form `apartment_###`. All 130 inventory records have a corresponding model
mesh.

The floor-plan, compass and site-plan assets are stored in `plans/` and are
served locally with the rest of the experience.

Select an apartment twice in the explorer to open its detail page, or open a
unit directly with `http://127.0.0.1:8080/unit-details.html?unit=43`.
