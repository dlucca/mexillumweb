import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('expediente module graph links with browser URL rules and no node_modules fallback',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const output=execFileSync(process.execPath,['--experimental-vm-modules','scripts/check-expediente-modules.mjs',root],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 assert.match(output,/Linked \d+ browser modules/);
});
