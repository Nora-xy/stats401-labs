const districts = ['Central', 'North', 'South', 'East', 'West'];
const services = ['Metro', 'Express', 'Shuttle'];
const color = d3.scaleOrdinal(districts, d3.schemeTableau10);
const serviceColor = d3.scaleOrdinal(services, ['#2166ac', '#c65d00', '#762a83']);
const dash = { Metro: null, Express: '9,4', Shuttle: '2,4' };
const shapes = { Local: d3.symbolCircle, Transfer: d3.symbolDiamond, Terminal: d3.symbolSquare };
const tooltip = d3.select('#tooltip');
function show(event, text) {
  tooltip.text(text).style('display', 'block')
    .style('left', `${event.pageX + 12}px`).style('top', `${event.pageY + 12}px`);
}
function hide() { tooltip.style('display', 'none'); }

Promise.all([
  d3.csv('../data/lab5_assignment_stations.csv', d => ({ ...d, daily_passengers: +d.daily_passengers })),
  d3.csv('../data/lab5_assignment_routes.csv', d => ({ ...d, travel_time_min: +d.travel_time_min }))
]).then(([nodes, routes]) => {
  const byId = new Map(nodes.map(d => [d.id, d]));
  if (nodes.length !== 50 || routes.length !== 50 || byId.size !== nodes.length ||
      nodes.some(d => !districts.includes(d.district) || !shapes[d.station_type] || !Number.isFinite(d.daily_passengers) || d.daily_passengers <= 0) ||
      routes.some(d => !byId.has(d.source) || !byId.has(d.target) || !services.includes(d.route_type) || !Number.isFinite(d.travel_time_min) || d.travel_time_min <= 0)) {
    throw new Error('Expected the provided 50-station, 50-route dataset with valid transit attributes.');
  }
  d3.select('#status').text('');
  const neighbors = new Map(nodes.map(d => [d.id, new Set()]));
  const connections = new Map();
  routes.forEach(d => {
    neighbors.get(d.source).add(d.target);
    neighbors.get(d.target).add(d.source);
    connections.set(`${d.source}|${d.target}`, d);
    connections.set(`${d.target}|${d.source}`, d);
  });
  const stationText = d => `${d.station_name} (${d.id})\nDistrict: ${d.district}\nDaily passengers: ${d.daily_passengers.toLocaleString()}\nType: ${d.station_type}\nDirect neighbors: ${neighbors.get(d.id).size}`;
  const routeText = d => `${byId.get(d.source).station_name} – ${byId.get(d.target).station_name}\n${d.route_type}: ${d.travel_time_min} minutes`;
  const times = d3.extent(routes, d => d.travel_time_min);
  const lineWidth = d3.scaleLinear(times, [1, 6]);
  const opacity = d3.scaleLinear(times, [0.3, 1]);
  const area = d3.scaleLinear([0, d3.max(nodes, d => d.daily_passengers)], [0, 650]);
  const legend = d3.select('#legend');
  legend.append('p').selectAll('span').data(districts).join('span').style('color', color).text(d => `● ${d}`);
  legend.append('p').text('Station type: ○ Local · ◇ Transfer · □ Terminal. Larger area = more daily passengers.');
  const key = legend.append('svg').attr('width', 600).attr('height', 30);
  services.forEach((type, i) => {
    key.append('line').attr('x1', i * 190).attr('x2', i * 190 + 50).attr('y1', 12).attr('y2', 12)
      .attr('stroke', '#555').attr('stroke-width', 2).attr('stroke-dasharray', dash[type]);
    key.append('text').attr('x', i * 190 + 60).attr('y', 17).text(type);
  });
  legend.append('p').text(`Travel time: thin/light = ${times[0]} min; thick/dark = ${times[1]} min.`);

  // Keep the original route IDs for the matrix; forceLink mutates its copies.
  const links = routes.map(d => ({ ...d }));
  const width = 980, height = 650;
  const svg = d3.select('#chart').append('svg').attr('width', width).attr('height', height)
    .attr('aria-label', 'Force-directed transit network');
  const link = svg.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', '#666').attr('stroke-width', d => lineWidth(d.travel_time_min))
    .attr('stroke-dasharray', d => dash[d.route_type]).attr('opacity', 0.65);
  const node = svg.append('g').attr('class', 'nodes').selectAll('path').data(nodes).join('path')
    .attr('d', d => d3.symbol().type(shapes[d.station_type]).size(area(d.daily_passengers))())
    .attr('fill', d => color(d.district));
  const label = svg.append('g').attr('class', 'labels').selectAll('text').data(nodes).join('text')
    .text(d => d.id).attr('dx', 18).attr('dy', 4);
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(75))
    .force('charge', d3.forceManyBody().strength(-130))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.035))
    .force('y', d3.forceY(height / 2).strength(0.035))
    .force('collision', d3.forceCollide(28))
    .on('tick', () => {
      nodes.forEach(d => {
        d.x = Math.max(28, Math.min(width - 48, d.x));
        d.y = Math.max(28, Math.min(height - 28, d.y));
      });
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      label.attr('x', d => d.x).attr('y', d => d.y);
    });
  node.call(d3.drag()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }).on('drag', (event, d) => {
      d.fx = Math.max(28, Math.min(width - 48, event.x));
      d.fy = Math.max(28, Math.min(height - 28, event.y));
    }).on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }));
  function reset() {
    node.attr('opacity', 1); label.attr('opacity', 1); link.attr('opacity', 0.65); hide();
  }
  node.on('mouseenter', (event, d) => {
    const visible = n => n.id === d.id || neighbors.get(d.id).has(n.id);
    node.attr('opacity', n => visible(n) ? 1 : 0.15);
    label.attr('opacity', n => visible(n) ? 1 : 0.15);
    link.attr('opacity', l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.08);
    show(event, stationText(d));
  }).on('mousemove', (event, d) => show(event, stationText(d))).on('mouseleave', reset);
  const forceRouteText = d => routeText({ ...d, source: d.source.id, target: d.target.id });
  link.on('mouseenter', (event, d) => {
    node.attr('opacity', n => n === d.source || n === d.target ? 1 : 0.15);
    label.attr('opacity', n => n === d.source || n === d.target ? 1 : 0.15);
    link.attr('opacity', l => l === d ? 1 : 0.08);
    show(event, forceRouteText(d));
  }).on('mousemove', (event, d) => show(event, forceRouteText(d))).on('mouseleave', reset);

  const ordered = [...nodes].sort((a, b) => districts.indexOf(a.district) - districts.indexOf(b.district) ||
    a.id.localeCompare(b.id, undefined, { numeric: true }));
  const size = 800;
  const band = d3.scaleBand(ordered.map(d => d.id), [0, size]).padding(0.06);
  const matrix = d3.select('#matrix').append('svg').attr('width', 890).attr('height', 900)
    .attr('aria-label', 'Transit adjacency matrix ordered by district')
    .append('g').attr('transform', 'translate(65,65)');
  const cells = ordered.flatMap(row => ordered.map(col => ({ row, col, route: connections.get(`${row.id}|${col.id}`) })));
  const cellText = d => d.route ? routeText(d.route) : `${d.row.station_name} – ${d.col.station_name}\nNo direct connection`;
  matrix.selectAll('rect.cell').data(cells).join('rect').attr('class', 'cell')
    .attr('x', d => band(d.col.id)).attr('y', d => band(d.row.id))
    .attr('width', band.bandwidth()).attr('height', band.bandwidth())
    .attr('fill', d => d.route ? serviceColor(d.route.route_type) : '#eee')
    .attr('fill-opacity', d => d.route ? opacity(d.route.travel_time_min) : 1)
    .on('mouseenter', function(event, d) { d3.select(this).attr('stroke', '#111'); show(event, cellText(d)); })
    .on('mousemove', (event, d) => show(event, cellText(d)))
    .on('mouseleave', function() { d3.select(this).attr('stroke', null); hide(); });
  for (const axis of ['row', 'column']) {
    matrix.append('g').selectAll('text').data(ordered).join('text')
      .attr('transform', d => axis === 'row' ? `translate(-7,${band(d.id) + band.bandwidth() / 2})` :
        `translate(${band(d.id) + band.bandwidth() / 2},-7) rotate(-90)`)
      .attr('text-anchor', axis === 'row' ? 'end' : 'start').attr('dy', '0.32em')
      .attr('font-size', 11).attr('fill', d => color(d.district)).text(d => d.id)
      .on('mouseenter', (event, d) => show(event, stationText(d)))
      .on('mousemove', (event, d) => show(event, stationText(d))).on('mouseleave', hide);
  }
  ordered.forEach((d, i) => {
    if (!i || d.district === ordered[i - 1].district) return;
    const p = band(d.id) - band.step() * 0.03;
    matrix.append('path').attr('d', `M0,${p}H${size}M${p},0V${size}`)
      .attr('stroke', '#888').attr('fill', 'none').attr('pointer-events', 'none');
  });

}).catch(error => {
  d3.select('#status').text(`Unable to load Lab 5: ${error.message} Place the two provided assignment CSVs in data/ and serve this page over HTTP.`);
  console.error(error);
});
