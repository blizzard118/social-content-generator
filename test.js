import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generate} from './service.js';
import {types,platforms,guidance} from './config.js';
test('all platforms have formats and guidance',()=>{for(const [name,formats] of Object.entries(platforms)){assert.ok(formats.length);assert.ok(guidance[name])}assert.equal(Object.keys(types).length,3)});
test('demo generation returns three editable drafts',async()=>{const key=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;try{const r=await generate({description:'A new bakery',platform:'Instagram'});assert.equal(r.mode,'demo');assert.equal(r.drafts.length,3);assert.ok(r.drafts.every(x=>x.body.includes('bakery')))}finally{if(key)process.env.OPENAI_API_KEY=key}});
