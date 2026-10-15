const fs=require('fs'),assert=require('node:assert/strict');
const {JSDOM}=require('../.lab8-cache/test/node_modules/jsdom');
async function check(supported){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/index.html','utf8'),{url:'http://localhost/lab10/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,q=s=>w.document.querySelector(s);let calls=0,rec;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('data/lab9/world.geojson','utf8')),text:async()=>fs.readFileSync('data/lab9_gdp_2025_top50.csv','utf8')});
 if(supported)w.SpeechRecognition=class{constructor(){rec=this;}start(){calls++;this.onstart();}abort(){this.onend();}};
 w.eval(fs.readFileSync('lab4/vendor/d3.v7.min.js','utf8'));
 w.eval(fs.readFileSync('lab9/lab9.js','utf8'));w.eval(fs.readFileSync(__dirname+'/lab10.js','utf8'));
 await new Promise(r=>setTimeout(r,150));
 try{
 assert.equal(w.document.documentElement.dataset.lab9Ready,'true');assert.equal(calls,0);
 const type=text=>{q('#command-input').value=text;q('#command-form').dispatchEvent(new w.Event('submit',{cancelable:true}));};
 type('Highlight Japan');assert.equal(q('#country-select').value,'JPN');assert.equal(w.document.querySelectorAll('.active').length,2);assert.equal(q('#choropleth').__zoom.k,3);
 type('Show Atlantis');assert.equal(q('#country-select').value,'JPN');assert.match(q('#voice-action').textContent,/not recognized/);
 type('Show USA');assert.equal(q('#country-select').value,'USA');
 type('Zoom in');assert.equal(q('#choropleth').__zoom.k,4.5);type('Zoom out');assert.equal(q('#choropleth').__zoom.k,3);
 type('Reset');assert.equal(q('#country-select').value,'');assert.equal(q('#choropleth').__zoom.k,1);
 if(supported){
 q('#voice-start').click();assert.equal(calls,1);assert(q('#voice-start').disabled);
 rec.onresult({results:[[{transcript:'Select Singapore'}]]});assert.equal(q('#country-select').value,'SGP');assert.match(q('#voice-heard').textContent,/Heard: Select Singapore/);rec.onend();assert(!q('#voice-start').disabled);
 q('#voice-start').click();rec.onerror({error:'not-allowed'});rec.onend();assert.match(q('#voice-status').textContent,/permission denied/);assert(!q('#voice-start').disabled);
 q('#voice-start').click();q('#voice-stop').click();rec.onresult({results:[[{transcript:'Highlight Japan'}]]});assert.equal(q('#country-select').value,'SGP');assert(q('#voice-stop').disabled);
 rec.start=()=>{throw Error('start failure');};q('#voice-start').click();assert(!q('#voice-start').disabled);assert.match(q('#voice-status').textContent,/Could not start/);
 }else{assert(q('#voice-start').disabled);assert.match(q('#voice-status').textContent,/unavailable/);}
 const words=q('#reflection').textContent.trim().split(/\s+/).length;assert(words>=100&&words<=200,words);
 console.log(`PASS: ${supported?'mock speech lifecycle, permission, cancellation, start failure':'unsupported speech fallback'}, linked selection, aliases, invalid commands, zoom/reset; ${words}-word reflection.`);
 }finally{w.close();}
}
check(true).then(()=>check(false)).catch(e=>{console.error(e);process.exitCode=1;});
