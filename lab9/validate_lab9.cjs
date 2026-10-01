const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM}=require('../.lab8-cache/test/node_modules/jsdom');
const root=path.resolve(__dirname,'..');
const geo=JSON.parse(fs.readFileSync(root+'/data/lab9/world.geojson','utf8'));
const csv=fs.readFileSync(root+'/data/lab9_gdp_2025_top50.csv','utf8');
async function run(fail=false){
  const dom=new JSDOM(fs.readFileSync(__dirname+'/index.html','utf8'),{url:'http://localhost:8000/lab9/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.fetch=async url=>{if(fail)throw new Error('Test network failure');return {ok:true,json:async()=>geo,text:async()=>csv};};
  w.eval(fs.readFileSync(root+'/lab4/vendor/d3.v7.min.js','utf8'));
  if(fail)w.console.error=()=>{};
  w.eval(fs.readFileSync(__dirname+'/lab9.js','utf8'));
  await new Promise(r=>setTimeout(r,100));
  try{
    const q=s=>w.document.querySelector(s),all=s=>[...w.document.querySelectorAll(s)];
    if(fail){assert(q('[role="alert"]').textContent.includes('Unable to load'));console.log('PASS: visible load-error state');return;}
    assert.equal(w.document.documentElement.dataset.lab9Ready,'true');
    assert.equal(all('.country').length,241);assert.equal(all('.economy').length,50);
    assert.equal(all('.country').filter(p=>p.__data__.stat).length,50);
    for(const p of all('.country')){assert(p.getAttribute('d')&&!/NaN/.test(p.getAttribute('d')));if(!p.__data__.stat)assert.equal(p.getAttribute('fill'),'#d9dfdb');}
    const nodes=all('.economy').map(p=>p.__data__);
    const ratio=nodes[0].r**2/nodes[0].value;
    for(const n of nodes){assert(Math.abs(n.r*n.r/n.value-ratio)<1e-10);assert(n.x-n.r>=0&&n.x+n.r<=760&&n.y-n.r>=0&&n.y+n.r<=480,`Clipped ${n.iso3}`);}
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)>=nodes[i].r+nodes[j].r-.05,'Circle overlap');
    const mapUSA=q('.country[data-iso3="USA"]'),cartUSA=q('.economy[data-iso3="USA"]');
    mapUSA.dispatchEvent(new w.MouseEvent('pointerenter',{clientX:100,clientY:100}));
    assert.equal(all('.active').length,2);assert(cartUSA.classList.contains('active'));assert(!q('#tooltip').hidden);assert(q('#tooltip').textContent.includes('30,615.743'));
    mapUSA.dispatchEvent(new w.MouseEvent('click'));mapUSA.dispatchEvent(new w.MouseEvent('pointerleave'));assert.equal(all('.active').length,2);assert(q('#tooltip').hidden);
    q('#clear').click();assert.equal(all('.active').length,0);
    cartUSA.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));assert(mapUSA.classList.contains('active'));
    cartUSA.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(all('.active').length,0);
    const select=q('#country-select');select.value='SGP';select.dispatchEvent(new w.Event('change'));assert.equal(all('.active').length,2);assert(q('.locator').getAttribute('display')!=='none');assert.equal(q('#choropleth').__zoom.k,3);
    q('[data-zoom="reset"]').click();assert.equal(q('#choropleth').__zoom.k,1);
    q('[data-zoom="in"]').click();assert.equal(q('#choropleth').__zoom.k,1.5);
    q('[data-zoom="out"]').click();assert.equal(q('#choropleth').__zoom.k,1);
    const missing=all('.country').find(p=>!p.__data__.stat);missing.dispatchEvent(new w.MouseEvent('pointerenter'));assert(q('#tooltip').textContent.includes('No data'));assert.equal(all('.economy.active').length,0);
    missing.dispatchEvent(new w.MouseEvent('pointerleave'));q('#clear').click();
    const words=q('#comparison').textContent.trim().split(/\s+/).length;assert(words>=150&&words<=250,words);
    fs.mkdirSync(root+'/.lab8-cache/lab9',{recursive:true});
    for(const id of ['choropleth','cartogram']){const svg=q('#'+id).cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','760');svg.setAttribute('height','480');svg.insertAdjacentHTML('afterbegin','<style>.country{stroke:#fffdf8;stroke-width:.5}.economy circle{stroke:#fffdf8;stroke-width:1.3}.economy text{font-family:Arial;text-anchor:middle;dominant-baseline:middle;font-weight:bold}</style>');fs.writeFileSync(root+'/.lab8-cache/lab9/'+id+'.svg',svg.outerHTML);}
    console.log(`PASS: 50/50 joins, missing values, geography paths, proportional areas, no overlaps/clipping, linked hover/click/keyboard, selector, zoom/reset, ${words}-word comparison.`);
  }finally{w.close();}
}
run().then(()=>run(true)).catch(e=>{console.error(e);process.exitCode=1;});
