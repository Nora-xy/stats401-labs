/* The two layouts share data, dimensions, ordering, and padding. */
(async function () {
  const status = document.querySelector('#status');
  try {
    if (!window.d3) throw new Error('D3 could not load. Check your internet connection.');
    const data = await d3.json('../data/lab6_assignment_gdp.json');
    const names = data.children.map(d => d.name);
    const color = d3.scaleOrdinal(names, ['#81b8de', '#eba575', '#a6c993', '#c2ace0', '#e7cc7b', '#87cbc5']);
    const shades = new Map();
    data.children.forEach(continent => {
      continent.children.forEach((region, i, regions) => {
        const base = d3.hsl(color(continent.name));
        base.l = regions.length === 1 ? 0.7 : 0.57 + i / (regions.length - 1) * 0.25;
        shades.set(`${continent.name}/${region.name}`, base.formatHex());
      });
    });
    const symbol = { Increase: '↑', Unchanged: '=', Decrease: '↓' };
    const number = d3.format(',');
    const tooltip = document.querySelector('#tooltip');
    const scope = document.querySelector('#scope');
    const hide = () => { tooltip.hidden = true; };
    function key(parent, label, fill) {
      const item = parent.append('span').attr('class', 'key');
      item.append('span').attr('class', 'swatch').style('background', fill);
      item.append('span').text(label);
    }
    names.forEach(name => {
      key(d3.select('#continent-legend'), name, color(name));
      scope.add(new Option(name, name));
    });
    data.children.forEach(continent => {
      const group = d3.select('#region-legend').append('div');
      group.append('strong').text(continent.name);
      continent.children.forEach(region => key(group, region.name, shades.get(`${continent.name}/${region.name}`)));
    });
    const all = d3.hierarchy(data).sum(d => d.gdp || 0);
    all.leaves().forEach(d => {
      const row = d3.select('#values').append('tr');
      [d.parent.parent.data.name, d.parent.data.name, d.data.name, number(d.value), d.data.status]
        .forEach(value => row.append('td').text(value));
    });
    status.textContent = `${all.leaves().length} countries · ${names.length} continents · Total GDP: $${number(all.value)} billion`;
    function details(d) {
      return `${d.data.name}\n${d.parent.parent.data.name} → ${d.parent.data.name}\nGDP: $${number(d.value)} billion\nStatus: ${d.data.status}`;
    }
    function show(event, d) {
      tooltip.textContent = details(d);
      tooltip.hidden = false;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX ?? bounds.left + bounds.width / 2;
      const y = event.clientY ?? bounds.top + bounds.height / 2;
      tooltip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(y + 14, innerHeight - tooltip.offsetHeight - 8))}px`;
    }
    function render(selector, tile, shaded) {
      const selected = scope.value === 'World' ? data : data.children.find(d => d.name === scope.value);
      // Retain World so continent and region depths remain identical when focused.
      const root = d3.hierarchy(selected === data ? data : {name: 'World', children: [selected]})
        .sum(d => d.gdp || 0).sort((a, b) => b.value - a.value || a.data.name.localeCompare(b.data.name));
      const width = 1100, height = 650;
      d3.treemap().tile(tile).size([width, height])
        .paddingOuter(d => d.depth === 0 ? 3 : 2)
        .paddingInner(2).paddingTop(d => d.depth === 1 ? 24 : d.depth === 2 ? 19 : 3)(root);
      const host = d3.select(selector);
      host.selectAll('*').remove();
      const svg = host.append('svg').attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'group').attr('aria-label', `${tile === d3.treemapBinary ? 'Binary' : 'Squarify'} GDP treemap: ${scope.value}`);
      const defs = svg.append('defs');
      const nodes = root.descendants().filter(d => d.depth > 0);
      nodes.forEach((d, i) => {
        d.clipId = `${selector.slice(1)}-clip-${i}`;
        defs.append('clipPath').attr('id', d.clipId).append('rect')
          .attr('width', Math.max(0, d.x1 - d.x0)).attr('height', Math.max(0, d.y1 - d.y0));
      });
      const parents = svg.selectAll('.group').data(nodes.filter(d => d.children)).join('g')
        .attr('class', 'group').attr('transform', d => `translate(${d.x0},${d.y0})`);
      parents.append('rect').attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0)
        .attr('fill', '#f7f8fa').attr('class', 'cell-border');
      parents.append('text').attr('clip-path', d => `url(#${d.clipId})`)
        .attr('x', 5).attr('y', d => d.depth === 1 ? 16 : 13).attr('font-size', d => d.depth === 1 ? 14 : 11)
        .attr('font-weight', d => d.depth === 1 ? 'bold' : 'normal').text(d => d.data.name);
      const cells = svg.selectAll('.country').data(root.leaves()).join('g').attr('class', 'country')
        .attr('transform', d => `translate(${d.x0},${d.y0})`).attr('tabindex', 0)
        .attr('aria-label', details).attr('aria-describedby', 'tooltip')
        .on('pointerenter pointermove click focus', show).on('pointerleave blur', hide)
        .on('keydown', event => { if (event.key === 'Escape') hide(); });
      cells.append('rect').attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0))
        .attr('fill', d => shaded ? shades.get(`${d.parent.parent.data.name}/${d.parent.data.name}`) : color(d.parent.parent.data.name))
        .attr('class', 'cell-border');
      const labels = cells.append('g').attr('clip-path', d => `url(#${d.clipId})`);
      labels.append('text').attr('x', 4).attr('y', 13).attr('font-size', 13).attr('font-weight', 'bold')
        .text(d => symbol[d.data.status]);
      labels.filter(d => d.x1 - d.x0 > 55 && d.y1 - d.y0 > 20)
        .append('text').attr('x', 19).attr('y', 13).attr('font-size', 12)
        .text(d => {
          const length = Math.floor((d.x1 - d.x0 - 23) / 7);
          return d.data.name.length > length ? d.data.name.slice(0, Math.max(1, length - 1)) + '…' : d.data.name;
        });
      labels.filter(d => d.x1 - d.x0 > 75 && d.y1 - d.y0 > 40)
        .append('text').attr('x', 5).attr('y', 32).attr('font-size', 11).text(d => `$${number(d.value)}B`);
      cells.append('title').text(details);
    }
    function draw() {
      hide();
      render('#treemap-one', d3.treemapSquarify, true);
      render('#treemap-two', d3.treemapBinary, true);
    }
    scope.addEventListener('change', draw);
    window.addEventListener('scroll', hide, true);
    draw();
  } catch (error) {
    status.textContent = `Unable to display the maps: ${error.message} Serve the repository with a local web server or GitHub Pages.`;
    console.error(error);
  }
})();
