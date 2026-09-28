# Starmap

A game-style navigation starmap rendered on a native HTML5 canvas. Sol plus the 99
nearest star systems, positioned in real galactic coordinates.

## Run

Open `index.html` directly in a browser. There is no build step and no dependencies.

## Layout

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and HUD panels |
| `css/style.css` | HUD styling |
| `js/stars.js` | Star catalogue (RA / Dec / distance) and conversion to galactic XYZ |
| `js/starmap.js` | Canvas renderer, camera, picking, routing, UI wiring |

## Controls

- Drag to pan, right-drag or shift-drag to rotate and tilt, wheel or pinch to zoom.
- Click a star to select it. The panel shows its data and plots a route from your
  current location using the jump range slider. Jump travels there.
- Arrows / WASD pan, Q / E rotate, T toggles top-down, R resets, C centres on your
  location, F focuses the selection, J jumps, `/` focuses search, `?` shows help.

## Coordinates

Galactic Cartesian, in light-years: +X toward the galactic centre, +Y along galactic
rotation, +Z toward the north galactic pole. Sol is the origin.

## Adding stars

Append a row to `RAW_STARS` in `js/stars.js`:

```js
["Name", raHours, decDegrees, distanceLy, "SpectralType", ["A · G2V", "B · K1V"], "Note"],
```

Colour, size, and classification are derived from the spectral type automatically.
