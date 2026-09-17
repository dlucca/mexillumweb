import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {expedienteEntry,expedienteLinks} from '../js/expediente.entry.js';
test('hub starts a fresh receipt flow instead of reopening an unrelated saved summary',()=>{
 assert.deepEqual(expedienteEntry({search:'?rapido&inicio=1',storedToken:'previous',profileId:'universidades'}),{token:'',installation:'university',focus:''});
 assert.equal(expedienteEntry({search:'?rapido&inicio=1',hash:'#exp=current',storedToken:'previous'}).token,'current');
 assert.equal(expedienteEntry({search:'?rapido',storedToken:'previous'}).token,'previous');
});
test('every hub option enters receipts, including universities and the unsure fallback',async()=>{
 const html=await readFile(new URL('../diagnostico/index.html',import.meta.url),'utf8');
 const cards=[...html.matchAll(/href="([^"]+)" data-profile="([^"]+)"/g)];assert.equal(cards.length,9);
 for(const [,href,profileId] of cards){const u=new URL(href.replaceAll('&amp;','&'),'https://www.mexillum.com');assert.ok(u.searchParams.has('rapido'));assert.equal(u.searchParams.get('inicio'),'1');assert.ok(expedienteEntry({profileId}).installation);}
 assert.match(html,/Universidades e instituciones educativas/);
 const page=await readFile(new URL('../diagnostico-universidades/index.html',import.meta.url),'utf8');assert.match(page,/diagnostico.universidades.view.js/);
});
test('a focused link opens only its part, and only when it carries its own key',()=>{
 assert.equal(expedienteEntry({hash:'#exp=abc&paso=operacion'}).focus,'operation');
 assert.equal(expedienteEntry({hash:'#exp=abc&paso=mapa'}).focus,'map');
 assert.equal(expedienteEntry({hash:'#exp=abc'}).focus,'');
 assert.equal(expedienteEntry({hash:'#exp=abc&paso=recibos'}).focus,'');
 assert.equal(expedienteEntry({hash:'#paso=mapa',storedToken:'previous'}).focus,'');
});
test('the advisor gets a full link, a form-only link and a map-only link for the same key',()=>{
 const links=expedienteLinks('https://www.mexillum.com','a b');
 assert.equal(links.full,'https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=a%20b');
 assert.equal(links.operacion,'https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=a%20b&paso=operacion');
 assert.equal(links.mapa,'https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=a%20b&paso=mapa');
 for(const [kind,href] of Object.entries(links))assert.equal(expedienteEntry({hash:new URL(href).hash}).focus,{full:'',operacion:'operation',mapa:'map'}[kind]);
});
