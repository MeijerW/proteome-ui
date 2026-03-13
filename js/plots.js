function plotSpatial(){

if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
    alert("Data is still loading. Please wait a moment and try again.");
    return;
}

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

let traces = []
let layout = {
title:"Spatial Expression",
template:"simple_white",
boxmode:"group",
height: 800,
width: 800
}

if(rnaGene.length > 0){
    traces.push({
        x:rnaGene.map(d=>d.group),
        y:rnaGene.map(d=>d["Z-score"]),
        type:"box",
        name:"RNA",
        marker:{color:"#d5af34"},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in RNA dataset")
}

if(protGene.length > 0){
    traces.push({
        x:protGene.map(d=>d.group),
        y:protGene.map(d=>d["Z-score"]),
        type:"box",
        name:"Protein",
        marker:{color:"#8281be"},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in Protein dataset")
}

if(traces.length === 2){
    layout.grid = {rows: 2, columns: 1, pattern: 'independent'}
    layout.xaxis = {title: 'Group'}
    layout.yaxis = {title: 'Z-score RNA'}
    layout.xaxis2 = {title: 'Group'}
    layout.yaxis2 = {title: 'Z-score Protein'}
} else if(traces.length === 1){
    // Single plot
    traces[0].xaxis = 'x'
    traces[0].yaxis = 'y'
    layout.xaxis = {title: 'Group'}
    layout.yaxis = {title: 'Z-score ' + traces[0].name}
}

Plotly.newPlot("plot", traces, layout)

}

function plotTemporal(){

if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
    alert("Data is still loading. Please wait a moment and try again.");
    return;
}

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
d.region &&
d.region.toLowerCase() === region.toLowerCase() &&
d.time >= 0
)

const protGene =
PROT_DATA.filter(
d=>d.Gene &&
d.Gene.toLowerCase()===gene &&
d.region &&
d.region.toLowerCase() === region.toLowerCase() &&
d.time >= 0
)

if(rnaGene.length===0 && protGene.length===0){
alert("Gene not found in selected region")
return
}

let traces = []
let layout = {
title:`Spatiotemporal Expression - ${region}`,
template:"simple_white",
height: 600,
width: 800
}

if(rnaGene.length > 0){
    traces.push({
        x:rnaGene.map(d=> (d.time + 1) * 30 ),
        y:rnaGene.map(d=>d["Z-score"]),
        type:"scatter",
        mode:"lines+markers",
        name:"RNA",
        marker:{color:"#d5af34"},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in RNA dataset")
}

if(protGene.length > 0){
    traces.push({
        x:protGene.map(d=> (d.time + 1) * 30 ),
        y:protGene.map(d=>d["Z-score"]),
        type:"scatter",
        mode:"lines+markers",
        name:"Protein",
        marker:{color:"#8281be"},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in Protein dataset")
}

if(traces.length === 2){
    layout.grid = {rows: 2, columns: 1, pattern: 'independent'}
    layout.xaxis = {title: 'Time (minutes)'}
    layout.yaxis = {title: 'Z-score RNA'}
    layout.xaxis2 = {title: 'Time (minutes)'}
    layout.yaxis2 = {title: 'Z-score Protein'}
} else if(traces.length === 1){
    // Single plot
    traces[0].xaxis = 'x'
    traces[0].yaxis = 'y'
    layout.xaxis = {title: 'Time (minutes)'}
    layout.yaxis = {title: 'Z-score ' + traces[0].name}
}

Plotly.newPlot("plot", traces, layout)

}

function plotSpatialHeatmap(){

if(RNA_DATA.length === 0){
    alert("Data is still loading. Please wait a moment and try again.");
    return;
}

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

const groups = [...new Set(RNA_DATA.map(d=>d.group))].sort((a,b) => {
    const order = ['Posterior', 'Anterior', 'Somite'];
    return order.indexOf(a) - order.indexOf(b);
})

const matrix = []
const geneLabels = []

genes.forEach(gene => {
    const rnaGene = RNA_DATA.filter(d=>d.Gene && d.Gene.toLowerCase()===gene)
    if(rnaGene.length > 0){
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

heatmap(matrix, geneLabels, groups)

}

function plotTemporalHeatmap(){

if(RNA_DATA.length === 0){
    alert("Data is still loading. Please wait a moment and try again.");
    return;
}

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
    const rnaGene = RNA_DATA.filter(d=>d.Gene && d.Gene.toLowerCase()===gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0)
    if(rnaGene.length > 0){
        const times = [...new Set(rnaGene.map(d=>d.time))].sort()
        const timeLabels = times.map(t => (t + 1) * 30)
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

const times = [...new Set(RNA_DATA.filter(d=>d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d=>d.time))].sort()
const timeLabels = times.map(t => (t + 1) * 30)

heatmap(matrix, geneLabels, timeLabels)

}