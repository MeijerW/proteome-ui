function plotSpatial(){

const gene =
document
.getElementById("spatialGene")
.value
.trim()
.toLowerCase()

const rnaGene =
RNA_DATA.filter(
d=>d.Gene &&
d.Gene.toLowerCase()===gene
)

const protGene =
PROT_DATA.filter(
d=>d.Gene &&
d.Gene.toLowerCase()===gene
)

if(rnaGene.length===0 && protGene.length===0){
alert("Gene not found")
return
}

const trace1={
x:rnaGene.map(d=>d.group),
y:rnaGene.map(d=>d["Z-score"]),
type:"box",
name:"RNA",
marker:{color:"#d5af34"}
}

const trace2={
x:protGene.map(d=>d.group),
y:protGene.map(d=>d["Z-score"]),
type:"box",
name:"Protein",
marker:{color:"#8281be"}
}

Plotly.newPlot(
"plot",
[trace1,trace2],
{
title:"Spatial Expression",
template:"simple_white",
boxmode:"group"
}
)

}