/* Local Census estimates and land areas; see data/README.md. */
const container = d3.select('#vis');
const format = d3.format(',.0f');
const densityFormat = d3.format(',.1f');
const schemes = {
  full: { thresholds: [1, 10, 50, 100, 500, 1000, 5000], colors: d3.schemeYlOrRd[8] },
  low: { thresholds: [1, 2, 5, 10, 20, 50, 100], colors: [...d3.schemeYlGnBu[7], '#aaa6a0'] }
};
let selected = null;
Promise.all([d3.json('data/counties-10m.json'), d3.csv('data/county-density-2020.csv')])
  .then(([us, rows]) => {
    const records = new Map(rows.map(r => [r.id, {...r, population: +r.population,
      land_sq_mi: +r.land_sq_mi, density: +r.population / +r.land_sq_mi}]));
    const counties = topojson.feature(us, us.objects.counties).features
      .filter(f => +String(f.id).slice(0, 2) < 57);
    counties.forEach(f => { f.record = records.get(String(f.id).padStart(5, '0')); });
    if (counties.some(f => !f.record)) throw new Error('County data join is incomplete.');
    const valid = counties.map(f => f.record);
    container.html('');
    const svg = container.append('svg').attr('viewBox', '0 0 1080 590')
      .attr('role', 'img').attr('aria-label', '2020 population density by county. Alaska and Hawaii are inset; Alaska is reduced in scale. Use county lookup for keyboard access.');
    svg.append('title').text('Population density: 50 states and Washington, DC');
    svg.append('defs').append('clipPath').attr('id', 'map-clip').append('rect').attr('width', 1080).attr('height', 570);
    const layer = svg.append('g').attr('clip-path', 'url(#map-clip)').append('g');
    const projection = d3.geoAlbersUsa().fitExtent([[12, 12], [1068, 552]], {type:'FeatureCollection', features:counties});
    const path = d3.geoPath(projection);
    const countyPaths = layer.selectAll('.county').data(counties).join('path')
      .attr('class', 'county').attr('d', path)
      .on('pointerenter', (_, f) => showRecord(f.record))
      .on('pointerleave', () => showRecord(selected))
      .on('click', (_, f) => { selected = f.record; d3.select('#county-search').property('value', selected.name); showRecord(selected); });
    countyPaths.append('title').text(f => `${f.record.name}: ${densityFormat(f.record.density)} people per land sq mi`);
    layer.append('path').datum(topojson.mesh(us, us.objects.states, (a,b) => a !== b))
      .attr('class', 'state-boundary').attr('d', path);
    svg.append('text').attr('x', 16).attr('y', 580).attr('class', 'map-note')
      .text('Alaska and Hawaii shown as insets. Alaska is reduced in scale. Territories excluded.');
    const zoom = d3.zoom().scaleExtent([1, 8]).extent([[0,0],[1080,570]])
      .translateExtent([[0,0],[1080,570]]).on('zoom', event => layer.attr('transform', event.transform));
    svg.call(zoom).on('wheel.zoom', null);
    d3.select('#zoom-in').on('click', () => svg.call(zoom.scaleBy, 1.5));
    d3.select('#zoom-out').on('click', () => svg.call(zoom.scaleBy, 1 / 1.5));
    d3.select('#reset-map').on('click', () => svg.call(zoom.transform, d3.zoomIdentity));
    d3.select('#county-options').selectAll('option').data([...valid].sort((a,b)=>d3.ascending(a.name,b.name)))
      .join('option').attr('value', d=>d.name);
    const search = d3.select('#county-search');
    function lookup() {
      selected = valid.find(r => r.name.toLowerCase() === search.property('value').trim().toLowerCase()) || null;
      showRecord(selected);
      if (!selected && search.property('value').trim()) d3.select('#county-detail').text('Choose a county from the suggestions to see its values.');
    }
    search.on('change', lookup).on('keydown', event => { if (event.key === 'Enter') lookup(); });
    d3.select('#clear-county').on('click', () => { selected=null; search.property('value',''); showRecord(null); });
    // Equal-width bins in log10 space: bar heights are comparable counts.
    const edges = d3.range(-2, 5.01, 0.5).map(v => 10 ** v);
    const bins = d3.pairs(edges).map(([x0,x1]) => ({x0,x1,count:valid.filter(r=>r.density>=x0 && r.density<x1).length}));
    if (d3.sum(bins,b=>b.count) !== valid.length) throw new Error('Histogram does not cover every county.');
    const hist = d3.select('#histogram').append('svg').attr('viewBox','0 0 1080 230')
      .attr('role','img').attr('aria-label', 'County counts in equal-width logarithmic density bins. Each county counts once, regardless of population.');
    const x = d3.scaleLog().domain([0.01,100000]).range([62,1055]);
    const y = d3.scaleLinear().domain([0,d3.max(bins,b=>b.count)]).nice().range([173,25]);
    hist.append('g').attr('class','axis').attr('transform','translate(0,173)')
      .call(d3.axisBottom(x).tickValues([.01,.1,1,10,100,1000,10000,100000]).tickFormat(d3.format('~g')));
    hist.append('g').attr('class','axis').attr('transform','translate(62,0)').call(d3.axisLeft(y).ticks(4));
    hist.append('text').attr('x',62).attr('y',16).attr('class','chart-title').text('Number of counties');
    hist.append('text').attr('x',1055).attr('y',216).attr('text-anchor','end').attr('class','map-note').text('People per land square mile (logarithmic scale)');
    const bars = hist.selectAll('.hist-bar').data(bins).join('rect').attr('class','hist-bar')
      .attr('x',b=>x(b.x0)+1).attr('width',b=>x(b.x1)-x(b.x0)-2)
      .attr('y',b=>y(b.count)).attr('height',b=>y(0)-y(b.count));
    bars.append('title').text(b=>`${d3.format('~g')(b.x0)} to <${d3.format('~g')(b.x1)} people/sq mi: ${format(b.count)} counties`);
    function showRecord(record) {
      countyPaths.classed('selected', f=>record?.id===f.record.id);
      bars.classed('active', b=>record && record.density>=b.x0 && record.density<b.x1);
      d3.select('#county-detail').text(record
        ? `${record.name} | ${densityFormat(record.density)} people / land sq mi | Population estimate: ${format(record.population)} | Land area: ${densityFormat(record.land_sq_mi)} sq mi`
        : 'Hover or tap a county, or use county lookup. Select a county to keep its values visible.');
    }
    function render() {
      const mode = d3.select('#mode').property('value');
      const {thresholds,colors} = schemes[mode];
      const color = d3.scaleThreshold(thresholds,colors);
      countyPaths.attr('fill',f=>color(f.record.density));
      const labels = [0,...thresholds].map((v,i)=> i===0 ? `< ${thresholds[0]}` : i===thresholds.length ? `≥ ${format(v)}` : `${format(v)}–<${format(thresholds[i])}`);
      const items = d3.select('#legend').html('').selectAll('div').data(labels).join('div').attr('class','legend-item');
      items.append('span').attr('class','swatch').style('background',(_,i)=>colors[i]);
      items.append('span').text(d=>d);
      d3.select('#scale-description').text(mode === 'low'
        ? 'Detail below 100: seven color classes separate rural densities. Gray means 100 or more, not missing data.'
        : 'National range: uneven thresholds preserve rural variation and distinguish metropolitan densities.');
    }
    d3.select('#mode').on('change',render);
    d3.select('#coverage').text(`${format(valid.length)} mapped county areas · July 2020 estimates · 50 states + DC`);
    render(); showRecord(null);
  }).catch(error => {
    console.error(error);
    container.html('<p class="loading" role="alert">The chart could not load its local data. Serve this folder with <code>python -m http.server 8000</code> and open <code>http://localhost:8000</code>. If hosted, check that the data and vendor folders were uploaded.</p>');
  });
