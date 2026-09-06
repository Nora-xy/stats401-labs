/* One 100% stacked D3 bar per relevance group. Values come from Python output. */
"use strict";
async function main() {
  const chart = document.getElementById("chart");
  try {
    if (!window.d3) throw new Error("D3 could not load.");
    const [rows, report, analysis] = await Promise.all([
      d3.csv("../data/lab4_sentiment_by_relevance.csv", d => ({
        ...d, count: +d.count, total: +d.total, proportion: +d.proportion
      })),
      d3.json("../data/lab4_cleaning_report.json"),
      d3.json("analysis.json")
    ]);
    const groups = ["Disaster-related", "Not disaster-related"];
    const sentiments = ["Negative", "Neutral", "Positive"];
    const colors = d3.scaleOrdinal(sentiments, ["#a74336", "#54657a", "#147a70"]);
    if (rows.length !== 6 || rows.some(d => !Number.isFinite(d.proportion) || d.total <= 0)) {
      throw new Error("The chart data is incomplete.");
    }
    const integer = d3.format(",");
    const percent = d3.format(".1%");
    d3.select("#sample-summary").text(`${integer(report.sample_rows)} tweets · random sample from ${integer(report.source_rows)} source records`);
    d3.select("#analysis-copy").selectAll("p").data(analysis.paragraphs).join("p").text(d => d);
    const table = d3.select("#summary-table").selectAll("tr").data(rows).join("tr");
    table.selectAll("td").data(d => [d.disaster_relevance, d.sentiment, integer(d.count), percent(d.proportion)])
      .join("td").text(d => d);
    function render() {
      const width = Math.max(270, chart.clientWidth);
      const height = 300;
      const margin = { left: 8, right: 12, top: 45, bottom: 35 };
      const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
      const svg = d3.select(chart).selectAll("svg").data([null]).join("svg")
        .attr("viewBox", `0 0 ${width} ${height}`).attr("role", "group")
        .attr("aria-label", "Sentiment percentages in disaster-related and unrelated tweets");
      svg.selectAll("*").remove();
      svg.append("title").text("Sentiment by disaster relevance");
      svg.append("desc").text("Two stacked bars show negative, neutral and positive sentiment shares. Exact values are available in the data table below.");
      svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickValues([0, .25, .5, .75, 1]).tickFormat(d3.format(".0%")));
      groups.forEach((group, index) => {
        const top = margin.top + index * 112;
        const values = sentiments.map(sentiment => rows.find(d => d.disaster_relevance === group && d.sentiment === sentiment));
        svg.append("text").attr("class", "group-label").attr("x", margin.left).attr("y", top - 17).text(group);
        svg.append("text").attr("class", "group-count").attr("x", width - margin.right)
          .attr("y", top + 77).text(`n = ${integer(values[0].total)}`);
        let start = 0;
        values.forEach(d => {
          const end = start + d.proportion;
          const detail = `${group}: ${d.sentiment.toLowerCase()} — ${integer(d.count)} of ${integer(d.total)} tweets (${percent(d.proportion)}).`;
          const rect = svg.append("rect").attr("class", "segment")
            .attr("x", x(start)).attr("y", top).attr("width", Math.max(0, x(end) - x(start)))
            .attr("height", 55).attr("fill", colors(d.sentiment)).attr("tabindex", 0)
            .attr("role", "img").attr("aria-label", detail);
          rect.append("title").text(detail);
          rect.on("mouseenter focus click", () => d3.select("#chart-detail").text(detail));
          if (x(end) - x(start) > 48) {
            svg.append("text").attr("class", "segment-label").attr("x", x((start + end) / 2))
              .attr("y", top + 33).text(d3.format(".0%")(d.proportion));
          }
          start = end;
        });
      });
    }
    render();
    new ResizeObserver(render).observe(chart);
    chart.setAttribute("aria-busy", "false");
  } catch (error) {
    chart.setAttribute("aria-busy", "false");
    chart.replaceChildren();
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = "The chart could not load. Open this page through a web server or GitHub Pages. The downloadable data remains available below.";
    chart.append(message);
    document.getElementById("sample-summary").textContent = "Chart unavailable";
    console.error(error);
  }
}
main();
