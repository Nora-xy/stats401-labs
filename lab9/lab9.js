/* D3 v7: local assets, ISO-3 join, choropleth + Dorling area cartogram. */
"use strict";
(async function () {
  const status = d3.select('#join-status');
  try {
    const [geo, rows] = await Promise.all([
      d3.json('../data/lab9/world.geojson'),
      d3.csv('../data/lab9_gdp_2025_top50.csv', d => ({
        iso3: d.iso3, country: d.country, value: +d.gdp_2025_billion_usd, rank: +d.rank
      }))
    ]);
    const stats = new Map(rows.map(d => [d.iso3, d]));
    const features = new Map(geo.features.map(d => [d.properties.iso3, d]));
    const unmatched = rows.filter(d => !features.has(d.iso3));
    if (stats.size !== 50 || rows.some(d => !Number.isFinite(d.value) || d.value <= 0) || unmatched.length) {
      throw new Error('GDP validation failed: check values and ISO-3 matches.');
    }
    geo.features.forEach(d => { d.iso3 = d.properties.iso3; d.stat = stats.get(d.iso3); });
    status.text('50 / 50 economies matched by ISO-3');
    const total = d3.sum(rows, d => d.value);
    d3.select('#total').text(`$${d3.format('.1f')(total / 1000)}T`);
    const fmt = d3.format(',.3f');
    const describe = iso3 => {
      const row = stats.get(iso3);
      return row ? `${row.country} · $${fmt(row.value)} billion · Rank ${row.rank} · ${d3.format('.1%')(row.value / total)} of included GDP`
        : `${features.get(iso3).properties.name} · No data in the provided top-50 dataset`;
    };
    const select = d3.select('#country-select');
    select.selectAll('option.economy-option').data([...rows].sort((a,b) => d3.ascending(a.country,b.country)))
      .join('option').attr('class','economy-option').attr('value',d=>d.iso3).text(d=>d.country);
    const width = 760, height = 480;
    const displayGeo = {type:'FeatureCollection',features:geo.features.filter(d=>d.iso3!=='ATA')};
    const projection = d3.geoNaturalEarth1().fitExtent([[20,40],[width-20,height-32]],displayGeo);
    const path = d3.geoPath(projection);
    const extent = d3.extent(rows,d=>d.value);
    const color = d3.scaleSequentialLog(d3.interpolateGnBu).domain(extent);
    const missing = '#d9dfdb';
    const map = d3.select('#choropleth');
    const mapGroup = map.append('g');
    const countries = mapGroup.selectAll('path').data(displayGeo.features).join('path')
      .attr('class','country').attr('data-iso3',d=>d.iso3).attr('d',path)
      .attr('fill',d=>d.stat ? color(d.stat.value) : missing)
      .attr('tabindex',0).attr('role','button').attr('aria-label',d=>describe(d.iso3));
    const locator = mapGroup.append('circle').attr('class','locator').attr('r',8).attr('display','none');
    const zoom = d3.zoom().extent([[0,0],[width,height]]).scaleExtent([1,8])
      .translateExtent([[-80,-60],[width+80,height+60]])
      .on('zoom',event=>{mapGroup.attr('transform',event.transform);locator.attr('r',8/event.transform.k);});
    map.call(zoom);
    d3.selectAll('[data-zoom]').on('click',function(){
      const action=this.dataset.zoom;
      if(action==='reset') map.call(zoom.transform,d3.zoomIdentity);
      else map.call(zoom.scaleBy,action==='in'?1.5:1/1.5);
    });
    const cart = d3.select('#cartogram');
    cart.append('g').attr('aria-hidden','true').selectAll('path').data(displayGeo.features)
      .join('path').attr('d',path).attr('fill','#edf0ec').attr('stroke','#fff').attr('stroke-width',.4);
    // r = k sqrt(GDP), hence pi r² = pi k² GDP. No minimum-size inflation.
    const radius = d3.scaleSqrt().domain([0,extent[1]]).range([0,73]);
    const nodes = rows.map(d=>{
      const [ax,ay]=projection(features.get(d.iso3).properties.anchor);
      return {...d,ax,ay,x:ax,y:ay,r:radius(d.value)};
    });
    const simulation=d3.forceSimulation(nodes)
      .force('x',d3.forceX(d=>d.ax).strength(.045))
      .force('y',d3.forceY(d=>d.ay).strength(.045))
      .force('collide',d3.forceCollide(d=>d.r+1.6).iterations(5)).stop();
    simulation.tick(400);
    // Relax residual overlaps after geographic attraction is removed.
    simulation.force('x',null).force('y',null).alpha(.15).tick(160);
    const bubbles=cart.append('g').selectAll('g').data(nodes).join('g')
      .attr('class','economy').attr('data-iso3',d=>d.iso3)
      .attr('transform',d=>`translate(${d.x},${d.y})`)
      .attr('tabindex',0).attr('role','button').attr('aria-label',d=>describe(d.iso3));
    bubbles.append('circle').attr('r',d=>d.r).attr('fill',d=>color(d.value));
    bubbles.append('text').text(d=>d.iso3).attr('fill',d=>d.value>2000?'#fff':'#173e4a');
    // ISO labels remain legible at the viewBox scale; full names appear on hover/focus.
    bubbles.select('text').style('font-size',d=>`${Math.min(10,d.r*.75)}px`);
    let pinned=null, hovered=null;
    const tooltip=d3.select('#tooltip');
    function highlight(){
      const id=hovered||pinned;
      countries.classed('active',d=>d.iso3===id).attr('aria-pressed',d=>String(d.iso3===pinned));
      bubbles.classed('active',d=>d.iso3===id).attr('aria-pressed',d=>String(d.iso3===pinned));
      d3.select('#selection').text(id?describe(id):'Hover to compare. Click a country to keep it selected in both views.');
      if(id && stats.has(id)){
        const [x,y]=projection(features.get(id).properties.anchor);
        locator.attr('cx',x).attr('cy',y).attr('display',null).raise();
      }else locator.attr('display','none');
    }
    function moveTip(event){
      const rect=tooltip.node().getBoundingClientRect();
      const target=event.currentTarget.getBoundingClientRect();
      const x=Number.isFinite(event.clientX)?event.clientX:target.x+target.width/2;
      const y=Number.isFinite(event.clientY)?event.clientY:target.y+target.height/2;
      tooltip.style('left',`${Math.max(8,Math.min(innerWidth-rect.width-8,x+14))}px`)
        .style('top',`${Math.max(8,Math.min(innerHeight-rect.height-8,y+14))}px`);
    }
    function bind(selection){
      selection.on('pointerenter focus',function(event,d){
        hovered=d.iso3;highlight();tooltip.text(describe(d.iso3)).property('hidden',false);moveTip(event);
      }).on('pointermove',moveTip).on('pointerleave blur',()=>{
        hovered=null;highlight();tooltip.property('hidden',true);
      }).on('click',function(event,d){
        pinned=pinned===d.iso3?null:d.iso3;select.property('value',stats.has(pinned)?pinned:'');highlight();
      }).on('keydown',function(event,d){
        if(event.key==='Enter'||event.key===' '){event.preventDefault();pinned=pinned===d.iso3?null:d.iso3;select.property('value',stats.has(pinned)?pinned:'');highlight();}
        if(event.key==='Escape') clear();
      });
    }
    bind(countries);bind(bubbles);
    function clear(){pinned=null;hovered=null;select.property('value','');tooltip.property('hidden',true);highlight();}
    d3.select('#clear').on('click',clear);
    select.on('change',function(){
      pinned=this.value||null;hovered=null;tooltip.property('hidden',true);highlight();
      if(pinned){
        const [x,y]=projection(features.get(pinned).properties.anchor);
        map.call(zoom.transform,d3.zoomIdentity.translate(width/2,height/2).scale(3).translate(-x,-y));
      }else map.call(zoom.transform,d3.zoomIdentity);
    });
    // A log-positioned axis precisely matches the sequential log colors.
    const legend=d3.select('#color-legend').append('svg').attr('viewBox','0 0 460 80').attr('aria-label','Logarithmic GDP color legend in billions of US dollars');
    const gradient=legend.append('defs').append('linearGradient').attr('id','gdp-gradient');
    gradient.selectAll('stop').data(d3.range(101)).join('stop').attr('offset',d=>`${d}%`)
      .attr('stop-color',d=>color(extent[0]*Math.pow(extent[1]/extent[0],d/100)));
    legend.append('text').attr('x',12).attr('y',14).attr('font-size',11).text('GDP · billions of US dollars (log scale)');
    legend.append('rect').attr('x',12).attr('y',24).attr('width',420).attr('height',12).attr('fill','url(#gdp-gradient)');
    const scale=d3.scaleLog().domain(extent).range([12,432]);
    legend.append('g').attr('transform','translate(0,36)').call(d3.axisBottom(scale)
      .tickValues([extent[0],1000,3000,10000,extent[1]]).tickFormat(d3.format(',.0f')).tickSize(4));
    legend.append('rect').attr('x',12).attr('y',65).attr('width',10).attr('height',10).attr('fill',missing);
    legend.append('text').attr('x',28).attr('y',74).attr('font-size',10).text('No data (not zero)');
    const area=d3.select('#area-legend').append('svg').attr('viewBox','0 0 460 80').attr('aria-label','Circle area legend in billions of US dollars');
    area.append('text').attr('x',12).attr('y',14).attr('font-size',11).text('Area ∝ GDP · billions of US dollars');
    [500,2000,5000].forEach((v,i)=>{
      const x=55+i*140,r=radius(v);
      area.append('circle').attr('cx',x).attr('cy',77-r).attr('r',r).attr('fill','none').attr('stroke','#126d72');
      area.append('text').attr('x',x+r+7).attr('y',60).attr('font-size',11).text(d3.format(',')(v));
    });
    highlight();
    document.documentElement.dataset.lab9Ready='true';
  } catch(error) {
    console.error(error);
    status.text(`Unable to load the maps: ${error.message} Serve this site over HTTP and reload.`).attr('role','alert');
  }
})();
