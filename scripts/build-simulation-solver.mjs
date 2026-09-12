import {build} from 'esbuild';
import {copyFile,writeFile} from 'node:fs/promises';
// Include transitive dependencies: copying YALPS's ESM distribution leaves a bare
// "heap" import that Node resolves but browsers cannot resolve without an import map.
await build({entryPoints:['node_modules/yalps/dist/index.js'],bundle:true,platform:'browser',format:'esm',minify:true,
  outfile:'js/vendor/yalps-0.6.3.bundle.js',banner:{js:'/* YALPS 0.6.3 + heap 0.2.7 · MIT · see yalps-LICENSE and heap-LICENSE */'}});
await copyFile('node_modules/yalps/LICENSE','js/vendor/yalps-LICENSE');
await copyFile('node_modules/heap/LICENSE','js/vendor/heap-LICENSE');
await writeFile('js/vendor/yalps-0.6.3.js',"// Compatibility entry for previously cached module URLs.\nexport * from './yalps-0.6.3.bundle.js';\n");
