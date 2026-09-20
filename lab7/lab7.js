/* Daily undirected relationships with a stable D3 force-directed layout. */
"use strict";
(async function () {
 const status = document.querySelector('#status');
 try {
  const parseDate = d3.timeParse('%Y-%m-%d');
  const [companies, transactions] = await Promise.all([
   d3.csv('../data/lab7_assignment_companies.csv'),
   d3.csv('../data/lab7_assignment_transactions_60days.csv', d => ({...d,date:parseDate(d.date),day:+d.day,amount_usd:+d.amount_usd,transaction_count:+d.transaction_count}))
  ]);
  const byId = new Map(companies.map(d=>[d.id,d]));
  if(companies.length!==12 || transactions.some(d=>!d.date || !byId.has(d.source) || !byId.has(d.target) || !Number.isFinite(d.amount_usd))) throw new Error('Invalid dataset');
  const key=d=>[d.source,d.target].sort().join('|');
  const money=d3.format('$,.0f'), exact=d3.format('$,.2f'), dateFormat=d3.timeFormat('%b %d, %Y');
  const patterns={goods:null,shipping:'9 4',components:'3 3',materials:'10 3 2 3',services:'2 5'};
  const sectors=[...new Set(companies.map(d=>d.sector))].sort();
  const color=d3.scaleOrdinal(sectors,['#c18a29','#368e9d','#9b6a9f','#db775c','#698446','#5665a0','#927359']);
  const frames=d3.range(1,61).map(day=>{
   const records=transactions.filter(d=>d.day===day);
   if(!records.length) throw new Error(`No observations for day ${day}`);
   const links=[...d3.group(records,key)].map(([id,rs])=>({id,source:rs[0].source,target:rs[0].target,amount:d3.sum(rs,d=>d.amount_usd),count:d3.sum(rs,d=>d.transaction_count),type:[...new Set(rs.map(d=>d.transaction_type))].join(', ')}));
   const volume=new Map(companies.map(d=>[d.id,0])), neighbors=new Map(companies.map(d=>[d.id,new Set()]));
   links.forEach(d=>{volume.set(d.source,volume.get(d.source)+d.amount);volume.set(d.target,volume.get(d.target)+d.amount);neighbors.get(d.source).add(d.target);neighbors.get(d.target).add(d.source);});
   const visited=new Set();let components=0;
   for(const company of companies){if(visited.has(company.id))continue;components++;const stack=[company.id];while(stack.length){const id=stack.pop();if(visited.has(id))continue;visited.add(id);neighbors.get(id).forEach(n=>stack.push(n));}}
   return {day,date:records[0].date,links,volume,neighbors,components,total:d3.sum(links,d=>d.amount),active:[...neighbors.values()].filter(s=>s.size).length,cross:links.filter(d=>byId.get(d.source).region!==byId.get(d.target).region).length};
  });
  const radius=d3.scaleSqrt().domain([0,d3.max(frames,f=>d3.max([...f.volume.values()]))]).range([0,32]);
  const width=d3.scaleSqrt().domain([0,d3.max(frames,f=>d3.max(f.links,d=>d.amount))]).range([1,9]);
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:320;
  const svg=d3.select('#network').append('svg').attr('viewBox','0 0 880 660').attr('role','group').attr('aria-label','Daily undirected network; focus companies and relationships for details');
  svg.append('title').text('Commercial relationships over 60 days');
  const linkGroup=svg.append('g'), nodeGroup=svg.append('g');
  // Separate force-link objects keep D3 endpoint mutation out of the source records.
  const union=[...new Map(transactions.map(d=>[key(d),{source:d.source,target:d.target}])).values()];
  const simulation=d3.forceSimulation(companies).force('link',d3.forceLink(union).id(d=>d.id).distance(170).strength(.12)).force('charge',d3.forceManyBody().strength(-650)).force('center',d3.forceCenter(440,330)).force('collision',d3.forceCollide(65)).stop();
  simulation.tick(400);
  const sx=d3.scaleLinear(d3.extent(companies,d=>d.x),[115,765]),sy=d3.scaleLinear(d3.extent(companies,d=>d.y),[70,565]);
  companies.forEach(d=>{d.x=sx(d.x);d.y=sy(d.y);d.fx=d.x;d.fy=d.y;});
  const nodes=nodeGroup.selectAll('g').data(companies,d=>d.id).join('g').attr('class','node').attr('transform',d=>`translate(${d.x},${d.y})`).attr('tabindex',0).attr('role','img');
  nodes.append('circle').attr('stroke',d=>color(d.sector)).attr('stroke-width',2.5);
  nodes.append('text').attr('class','node-label').attr('text-anchor','middle').attr('y',49).text(d=>d.company_name);
  const tooltip=d3.select('#tooltip');
  function hideTip(){tooltip.property('hidden',true);}
  function showTip(event,html){
   tooltip.html(html).property('hidden',false);const box=event.currentTarget.getBoundingClientRect(),tip=tooltip.node().getBoundingClientRect();
   const x=event.clientX||box.x+box.width/2,y=event.clientY||box.y+box.height/2;
   tooltip.style('left',`${Math.max(8,Math.min(x+15,innerWidth-tip.width-8))}px`).style('top',`${Math.max(8,Math.min(y+15,innerHeight-tip.height-8))}px`);
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});window.addEventListener('scroll',hideTip,{passive:true});
  let currentDay=1,timer=null;
  nodes.on('pointerenter focus click',function(event,d){const f=frames[currentDay-1];showTip(event,`<strong>${d.company_name}</strong><br>${d.sector} · ${d.region}<br>Day ${currentDay} · ${dateFormat(f.date)}<br>Incident value: ${exact(f.volume.get(d.id))}<br>Active partners: ${f.neighbors.get(d.id).size}`);}).on('pointerleave blur',hideTip);
  d3.select('#sector-legend').selectAll('div').data(sectors).join('div').attr('class','legend-row').html(d=>`<span class="swatch" style="background:${color(d)}"></span>${d}`);
  d3.select('#type-legend').selectAll('div').data(Object.entries(patterns)).join('div').attr('class','legend-row').html(([type,dash])=>`<svg aria-hidden="true"><line x1="2" x2="48" y1="9" y2="9" stroke="#627d89" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/></svg>${type}`);
  d3.select('#width-legend').selectAll('div').data([10000,30000,50000]).join('div').attr('class','legend-row').html(d=>`<svg aria-hidden="true"><line x1="2" x2="48" y1="9" y2="9" stroke="#627d89" stroke-width="${width(d)}"/></svg>${money(d)}`);
  const timeline=d3.select('#timeline').append('svg').attr('viewBox','0 0 1100 150').attr('role','group').attr('aria-label','Active relationships per day');
  const tx=d3.scaleBand().domain(d3.range(1,61)).range([36,1088]).padding(.22),ty=d3.scaleLinear().domain([0,d3.max(frames,f=>f.links.length)]).nice().range([115,12]);
  timeline.append('g').attr('class','axis').attr('transform','translate(32,0)').call(d3.axisLeft(ty).ticks(4).tickSize(0)).call(g=>g.select('.domain').remove());
  const bars=timeline.append('g').selectAll('rect').data(frames).join('rect').attr('class','timeline-bar').attr('x',f=>tx(f.day)).attr('y',f=>ty(f.links.length)).attr('width',tx.bandwidth()).attr('height',f=>115-ty(f.links.length)).attr('tabindex',0).attr('role','button').attr('aria-label',f=>`Day ${f.day}, ${dateFormat(f.date)}, ${f.links.length} relationships`).on('click',(_,f)=>{pause();showDay(f.day);}).on('keydown',(e,f)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pause();showDay(f.day);}});
  bars.append('title').text(f=>`Day ${f.day}: ${f.links.length} active relationships`);
  timeline.append('g').selectAll('text').data([1,10,20,30,40,50,60]).join('text').attr('x',d=>tx(d)+tx.bandwidth()/2).attr('y',138).attr('text-anchor','middle').attr('class','axis').text(d=>`Day ${d}`);
  function showDay(day){
   currentDay=Math.max(1,Math.min(60,day));hideTip();const f=frames[currentDay-1];
   d3.select('#date-label').text(`Day ${currentDay} · ${dateFormat(f.date)}`);d3.select('#day-output').text(currentDay);
   d3.select('#time-slider').property('value',currentDay).attr('aria-valuetext',`Day ${currentDay}, ${dateFormat(f.date)}`);
   d3.select('#active-companies').text(f.active);d3.select('#active-links').text(f.links.length);d3.select('#total-value').text(money(f.total));d3.select('#cross-regional').text(d3.format('.0%')(f.cross/f.links.length));
   // Cancel old exits before joining: rapid scrubbing must not remove re-entered links.
   linkGroup.selectAll('line').interrupt();
   const links=linkGroup.selectAll('line').data(f.links,d=>d.id).join(enter=>enter.append('line').attr('class','link').attr('opacity',0),update=>update,exit=>exit.attr('tabindex',null).style('pointer-events','none').transition().duration(duration).attr('opacity',0).remove());
   links.attr('x1',d=>byId.get(d.source).x).attr('y1',d=>byId.get(d.source).y).attr('x2',d=>byId.get(d.target).x).attr('y2',d=>byId.get(d.target).y).attr('stroke','#627d89').attr('stroke-dasharray',d=>patterns[d.type]||null).attr('tabindex',0).attr('role','img').style('pointer-events','stroke').attr('aria-label',d=>`${byId.get(d.source).company_name} and ${byId.get(d.target).company_name}: ${d.type}, ${exact(d.amount)}, ${d.count} transactions`).on('pointerenter focus click',(event,d)=>showTip(event,`<strong>${byId.get(d.source).company_name}<br>↔ ${byId.get(d.target).company_name}</strong><br>Day ${currentDay} · ${dateFormat(f.date)}<br>${d.type} · ${d.count} transactions<br>${exact(d.amount)}<br>${byId.get(d.source).region} ↔ ${byId.get(d.target).region}`)).on('pointerleave blur',hideTip);
   links.transition().duration(duration).attr('opacity',.7).attr('stroke-width',d=>width(d.amount));
   nodes.attr('aria-label',d=>`${d.company_name}, ${d.sector}, ${d.region}, incident volume ${exact(f.volume.get(d.id))}, ${f.neighbors.get(d.id).size} partners`);
   nodes.select('circle').interrupt().transition().duration(duration).attr('r',d=>f.volume.get(d.id)?radius(f.volume.get(d.id)):6).attr('fill',d=>f.volume.get(d.id)?color(d.sector):'white');
   bars.attr('fill',d=>d.day===currentDay?'#087e80':'#c6d9d3').attr('aria-pressed',d=>String(d.day===currentDay));
   d3.select('#daily-rows').selectAll('tr').data(f.links,d=>d.id).join('tr').html(d=>`<td>${byId.get(d.source).company_name} ↔ ${byId.get(d.target).company_name}</td><td>${d.type}</td><td>${exact(d.amount)}</td><td>${d.count}</td><td>${byId.get(d.source).region} ↔ ${byId.get(d.target).region}</td>`);
  }
  function pause(){if(timer)timer.stop();timer=null;d3.select('#play-state').text('Paused');d3.select('#play').property('disabled',false);d3.select('#pause').property('disabled',true);}
  function play(){if(timer)return;if(currentDay===60)showDay(1);d3.select('#play-state').text('Playing');d3.select('#play').property('disabled',true);d3.select('#pause').property('disabled',false);timer=d3.interval(()=>{showDay(currentDay+1);if(currentDay===60)pause();},900);}
  d3.select('#play').on('click',play);d3.select('#pause').on('click',pause);d3.select('#reset').property('disabled',false).on('click',()=>{pause();showDay(1);});
  d3.select('#time-slider').property('disabled',false).on('input',function(){pause();showDay(+this.value);});
  d3.selectAll('.jump').on('click',function(){pause();showDay(+this.dataset.day);document.querySelector('.dashboard').scrollIntoView({behavior:'auto'});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  d3.select('#period-rows').selectAll('tr').data([0,20,40]).join('tr').html(start=>{const fs=frames.slice(start,start+20);return `<td>Days ${start+1}–${start+20}</td><td>${d3.mean(fs,f=>f.links.length).toFixed(2)}</td><td>${d3.mean(fs,f=>f.components).toFixed(2)}</td><td>${money(d3.mean(fs,f=>f.total))}</td><td>${d3.format('.1%')(d3.sum(fs,f=>f.cross)/d3.sum(fs,f=>f.links.length))}</td>`;});
  pause();showDay(1);status.textContent=`${companies.length} companies · ${transactions.length} records · 60 daily snapshots · Select a day or press Play to explore.`;
 }catch(error){status.textContent=`Unable to load the visualization: ${error.message}. Serve this folder over HTTP and check that D3 and both CSV files are available.`;status.style.color='#a22d32';console.error(error);}
})();
