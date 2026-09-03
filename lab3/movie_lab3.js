// Load the movie CSV created by movie_scraper.py and make its headings sortable.
d3.csv("../data/lab3_data.csv").then(data => {
    const columns = data.columns;
    const table = d3.select("#data-table");
    let sortedColumn = null;
    let ascending = true;

    table.select("thead").append("tr").selectAll("th").data(columns).join("th")
        .text(column => column).on("click", (event, column) => {
            ascending = column === sortedColumn ? !ascending : true;
            sortedColumn = column;
            data.sort((a, b) => ascending ? d3.ascending(a[column] || "", b[column] || "") : d3.descending(a[column] || "", b[column] || ""));
            drawRows();
        });

    function drawRows() {
        table.select("tbody").selectAll("tr").data(data).join("tr").selectAll("td")
            .data(row => columns.map(column => row[column])).join("td").text(value => value);
    }
    drawRows();
});
