import {build} from 'esbuild';
import {copyFile,readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['node_modules/pdf-lib/es/index.js'],bundle:true,platform:'browser',format:'esm',supported:{'template-literal':false},minify:true,outfile:'js/vendor/pdf-lib-1.17.1.bundle.js',banner:{js:'/* pdf-lib 1.17.1 · MIT · see pdf-lib-LICENSE */'}});
await copyFile('node_modules/pdf-lib/LICENSE.md','js/vendor/pdf-lib-LICENSE');

// Template literals are emitted as escaped strings; trim only generated comment whitespace.
const output='js/vendor/pdf-lib-1.17.1.bundle.js';
await writeFile(output,(await readFile(output,'utf8')).replace(/[ \t]+$/gm,''));
