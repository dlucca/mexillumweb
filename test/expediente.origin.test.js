import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalExpedienteURL, redirectToCanonicalHost} from '../js/expediente.origin.js';

test('apex links move to www without losing path, query or confidential fragment',()=>{
 const source='https://mexillum.com/diagnostico-industria-comercio?rapido#exp=abc123';
 assert.equal(canonicalExpedienteURL(source),'https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=abc123');
});

test('www and local demo addresses are left unchanged',()=>{
 assert.equal(canonicalExpedienteURL('https://www.mexillum.com/asesor/'),null);
 assert.equal(canonicalExpedienteURL('http://127.0.0.1:4173/asesor/'),null);
});

test('redirect helper replaces only an apex address',()=>{
 let replaced='';
 assert.equal(redirectToCanonicalHost({href:'https://mexillum.com/asesor/',replace:value=>{replaced=value;}}),true);
 assert.equal(replaced,'https://www.mexillum.com/asesor/');
 assert.equal(redirectToCanonicalHost({href:'https://www.mexillum.com/asesor/',replace:()=>assert.fail()}),false);
});
