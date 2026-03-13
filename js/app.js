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

function showMainTab(id){

document
.querySelectorAll(".mainTab")
.forEach(t=>t.style.display="none")

document
.getElementById(id)
.style.display="block"

}

function showSubTab(id){

document
.querySelectorAll(".subTab")
.forEach(t=>t.style.display="none")

document
.getElementById(id)
.style.display="block"

}


function showPanel(id){

document
.querySelectorAll(".panel")
.forEach(p=>p.style.display="none")

document
.getElementById(id)
.style.display="block"

}

function runSpatial(){

const gene =
document
.getElementById("geneInput")
.value
.trim()
.toLowerCase()

spatialPlot(gene)

}