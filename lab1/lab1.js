async function drawChart() {
  d3.select("#chart-title").text("Student Scores");
  const data = await d3.csv("../data/students.csv", d => ({
    name: d.name,
    score: +d.score
  }));
  console.log("Loaded student data:", data);

  const width = 820;
  const height = 440;
  const margin = { top: 28, right: 24, bottom: 78, left: 24 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.22);
  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Bar chart of student scores");
  const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  plot.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.name))
    .attr("y", d => y(d.score))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.score));

  plot.selectAll(".score-label")
    .data(data)
    .join("text")
    .attr("class", "score-label")
    .attr("x", d => x(d.name) + x.bandwidth() / 2)
    .attr("y", d => y(d.score) - 9)
    .text(d => d.score);

  plot.selectAll(".label")
    .data(data)
    .join("text")
    .attr("class", "label")
    .attr("x", d => x(d.name) + x.bandwidth() / 2)
    .attr("y", innerHeight + 25)
    .text(d => d.name);
}

drawChart().catch(error => {
  console.error(error);
  d3.select("#chart").append("p").attr("class", "error")
    .text("The data could not be loaded. Run this site with a local web server.");
});
