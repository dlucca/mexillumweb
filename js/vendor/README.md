# Browser solver

`yalps-0.6.3.bundle.js` bundles YALPS 0.6.3 **and its heap 0.2.7 dependency** as a self-contained browser ESM module. There are no bare package imports or runtime CDN requests. Both libraries use the MIT license; their notices are included as `yalps-LICENSE` and `heap-LICENSE`.

Rebuild with `npm ci && npm run build:simulation`. Exact dependencies and esbuild are locked in package-lock.json; the build script is `scripts/build-simulation-solver.mjs`.

Upstream: https://github.com/IanManske/YALPS and https://github.com/qiao/heap.js.

The old `yalps-0.6.3.js` URL now re-exports the self-contained bundle for previously cached module URLs. New code must use the bundled file. Node can resolve the old file's bare import from node_modules, masking its incompatibility with browsers. The browser-module regression test links the entire expediente module graph without Node package resolution to catch this failure.
