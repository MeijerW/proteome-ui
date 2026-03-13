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

function plotTemporal(){

const gene =
document
.getElementById("temporalGene")
.value
.trim()
.toLowerCase()

const region =
document
.getElementById("region")
.value

const rnaGene =
RNA_DATA.filter(
d=>d.Gene &&
d.Gene.toLowerCase()===gene &&
d.region === region
)

const protGene =
PROT_DATA.filter(
d=>d.Gene &&
d.Gene.toLowerCase()===gene &&
d.region === region
)

if(rnaGene.length===0 && protGene.length===0){
alert("Gene not found in selected region")
return
}

const trace1={
x:rnaGene.map(d=>d.time),
y:rnaGene.map(d=>d["Z-score"]),
type:"scatter",
mode:"lines+markers",
name:"RNA",
marker:{color:"#d5af34"}
}

const trace2={
x:protGene.map(d=>d.time),
y:protGene.map(d=>d["Z-score"]),
type:"scatter",
mode:"lines+markers",
name:"Protein",
marker:{color:"#8281be"}
}

Plotly.newPlot(
"plot",
[trace1,trace2],
{
title:`Spatiotemporal Expression - ${region}`,
template:"simple_white"
}
)

}

function plotSpatialHeatmap(){

const genesText =
document
.getElementById("spatialGenes")
.value
.trim()

if(!genesText){
alert("Enter genes")
return
}

const genes = genesText.split(',').map(g=>g.trim().toLowerCase()).filter(g=>g)

const matrix = []
const geneLabels = []

genes.forEach(gene => {
    const rnaGene = RNA_DATA.filter(d=>d.Gene && d.Gene.toLowerCase()===gene)
    if(rnaGene.length > 0){
        const groups = [...new Set(rnaGene.map(d=>d.group))].sort()
        const row = groups.map(group => {
            const entry = rnaGene.find(d=>d.group === group)
            return entry ? entry["Z-score"] : 0
        })
        matrix.push(row)
        geneLabels.push(rnaGene[0].Gene)
    }
})

if(matrix.length === 0){
alert("No valid genes found")
return
}

const groups = [...new Set(RNA_DATA.map(d=>d.group))].sort()

heatmap(matrix, geneLabels, groups)

}

function plotTemporalHeatmap(){

const genesText =
document
.getElementById("temporalGenes")
.value
.trim()

if(!genesText){
alert("Enter genes")
return
}

const region =
document
.getElementById("heatmapRegion")
.value

const genes = genesText.split(',').map(g=>g.trim().toLowerCase()).filter(g=>g)

const matrix = []
const geneLabels = []

genes.forEach(gene => {
    const rnaGene = RNA_DATA.filter(d=>d.Gene && d.Gene.toLowerCase()===gene && d.region === region)
    if(rnaGene.length > 0){
        const times = [...new Set(rnaGene.map(d=>d.time))].sort()
        const row = times.map(time => {
            const entry = rnaGene.find(d=>d.time === time)
            return entry ? entry["Z-score"] : 0
        })
        matrix.push(row)
        geneLabels.push(rnaGene[0].Gene)
    }
})

if(matrix.length === 0){
alert("No valid genes found in selected region")
return
}

const times = [...new Set(RNA_DATA.filter(d=>d.region === region).map(d=>d.time))].sort()

heatmap(matrix, geneLabels, times)

}