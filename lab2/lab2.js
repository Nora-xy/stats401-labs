const width = 800;
const height = 500;
const margin = { top: 40, right: 170, bottom: 70, left: 80 };
const tooltip = d3.select("#tooltip");

d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
})).then(data => {
    const svg = d3.select("#chart").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "City population, temperature, development level, and region scatterplot");
    const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.population)]).nice()
        .range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain(d3.extent(data, d => d.temp_c)).nice()
        .range([height - margin.bottom, margin.top]);
    const regions = ["North", "South", "East", "West"];
    const developmentLevels = ["Low", "Medium", "High"];
    const colorScale = d3.scaleOrdinal().domain(regions).range(d3.schemeTableau10);
    const sizeScale = d3.scaleOrdinal().domain(developmentLevels).range([6, 10, 14]);

    svg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(xScale));
    svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(yScale));
    svg.append("text").attr("class", "axis-label").attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 20).attr("text-anchor", "middle").text("Population (millions)");
    svg.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)")
        .attr("x", -height / 2).attr("y", 22).attr("text-anchor", "middle").text("Average temperature (°C)");

    svg.selectAll(".city-point").data(data).join("circle")
        .attr("class", "city-point").attr("cx", d => xScale(d.population)).attr("cy", d => yScale(d.temp_c))
        .attr("r", d => sizeScale(d.development_level)).attr("fill", d => colorScale(d.region)).attr("opacity", 0.82)
        .on("mouseover", (event, d) => tooltip.style("opacity", 1).html(`<strong>${d.city}</strong><br>Population: ${d.population} million<br>Temperature: ${d.temp_c} °C<br>Development: ${d.development_level}<br>Region: ${d.region}`))
        .on("mousemove", event => tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY + 12}px`))
        .on("mouseout", () => tooltip.style("opacity", 0));

    const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 28}, 55)`);
    legend.append("text").attr("class", "legend-title").text("Region (color)");
    const regionItems = legend.selectAll(".region-legend").data(regions).join("g")
        .attr("transform", (d, i) => `translate(0, ${22 + i * 25})`);
    regionItems.append("circle").attr("r", 7).attr("fill", d => colorScale(d));
    regionItems.append("text").attr("x", 14).attr("y", 4).text(d => d);
    legend.append("text").attr("class", "legend-title").attr("y", 138).text("Development (size)");
    const sizeItems = legend.selectAll(".size-legend").data(developmentLevels).join("g")
        .attr("transform", (d, i) => `translate(8, ${164 + i * 30})`);
    sizeItems.append("circle").attr("r", d => sizeScale(d)).attr("fill", "#64748b").attr("opacity", 0.8);
    sizeItems.append("text").attr("x", 22).attr("y", 4).text(d => d);
}).catch(error => {
    console.error(error);
    d3.select("#chart").append("p").attr("class", "error")
        .text("The city data could not be loaded. Please open this page through a local server or GitHub Pages.");
});


