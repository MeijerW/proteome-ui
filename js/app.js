function runViewer(){

let gene =
document
.getElementById("geneInput")
.value
.toLowerCase()

let viewer =
document
.getElementById("viewer")
.value

if(viewer==="spatial")
spatialPlot(gene)

if(viewer==="temporal")
temporalPlot(gene)

}
