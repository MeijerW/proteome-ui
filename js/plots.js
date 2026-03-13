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
d=>d.ID &&
String(d.ID).toLowerCase()===gene
)

const protGene =
PROT_DATA.filter(
d=>d.ID &&
String(d.ID).toLowerCase()===gene
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
    const order = ['Posterior', 'Anterior', 'Somite']
    rnaGene.sort((a,b) => order.indexOf(a.group) - order.indexOf(b.group))
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
    const order = ['Posterior', 'Anterior', 'Somite']
    protGene.sort((a,b) => order.indexOf(a.group) - order.indexOf(b.group))
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
d=>d.ID &&
String(d.ID).toLowerCase()===gene &&
d.region &&
d.region.toLowerCase() === region.toLowerCase() &&
d.time >= 0
)

const protGene =
PROT_DATA.filter(
d=>d.ID &&
String(d.ID).toLowerCase()===gene &&
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
    // Group by time
    const times = [...new Set(rnaGene.map(d=>d.time))].sort()
    times.forEach(time => {
        const yVals = rnaGene.filter(d=>d.time === time).map(d=>d["Z-score"])
        traces.push({
            x: [time],
            y: yVals,
            type: "box",
            name: `RNA ${time}min`,
            marker: {color: "#d5af34"},
            xaxis: traces.length === 0 ? 'x' : 'x2',
            yaxis: traces.length === 0 ? 'y' : 'y2'
        })
    })
    // Stripplot
    traces.push({
        x: rnaGene.map(d=>d.time),
        y: rnaGene.map(d=>d["Z-score"]),
        mode: "markers",
        type: "scatter",
        name: "RNA points",
        marker: {color: "#d5af34", size: 6},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in RNA dataset")
}

if(protGene.length > 0){
    const times = [...new Set(protGene.map(d=>d.time))].sort()
    times.forEach(time => {
        const yVals = protGene.filter(d=>d.time === time).map(d=>d["Z-score"])
        traces.push({
            x: [time],
            y: yVals,
            type: "box",
            name: `Protein ${time}min`,
            marker: {color: "#8281be"},
            xaxis: traces.length === 0 ? 'x' : 'x2',
            yaxis: traces.length === 0 ? 'y' : 'y2'
        })
    })
    traces.push({
        x: protGene.map(d=>d.time),
        y: protGene.map(d=>d["Z-score"]),
        mode: "markers",
        type: "scatter",
        name: "Protein points",
        marker: {color: "#8281be", size: 6},
        xaxis: traces.length === 0 ? 'x' : 'x2',
        yaxis: traces.length === 0 ? 'y' : 'y2'
    })
} else {
    alert("Gene not found in Protein dataset")
}

if(traces.length > 0){
    layout.xaxis = {title: 'Time (minutes)', type: 'category'}
    layout.yaxis = {title: 'Z-score RNA'}
    if(traces.some(t=>t.xaxis === 'x2')){
        layout.xaxis2 = {title: 'Time (minutes)', type: 'category'}
        layout.yaxis2 = {title: 'Z-score Protein'}
    }
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

const matrixRNA = []
const matrixProt = []
const geneLabels = []

genes.forEach(gene => {
    const rnaGene = RNA_DATA.filter(d=>d.ID && String(d.ID).toLowerCase()===gene)
    const protGene = PROT_DATA.filter(d=>d.ID && String(d.ID).toLowerCase()===gene)
    if(rnaGene.length > 0){
        const rowRNA = groups.map(group => {
            const entry = rnaGene.find(d=>d.group === group)
            return entry ? entry["Z-score"] : 0
        })
        matrixRNA.push(rowRNA)
        const rowProt = groups.map(group => {
            const entry = protGene.find(d=>d.group === group)
            return entry ? entry["Z-score"] : 0
        })
        matrixProt.push(rowProt)
        geneLabels.push(rnaGene[0].ID)
    }
})

if(matrixRNA.length === 0){
alert("No valid genes found")
return
}

const data = [
    {
        z: matrixRNA,
        x: groups,
        y: geneLabels,
        type: "heatmap",
        colorscale: "Viridis",
        xaxis: 'x',
        yaxis: 'y',
        name: 'RNA'
    },
    {
        z: matrixProt,
        x: groups,
        y: geneLabels,
        type: "heatmap",
        colorscale: "Viridis",
        xaxis: 'x2',
        yaxis: 'y2',
        name: 'Protein'
    }
]

const layout = {
    title: "Spatial Expression Heatmap",
    grid: {rows: 1, columns: 2, pattern: 'independent'},
    xaxis: {title: 'Group', type: 'category'},
    yaxis: {title: 'Genes'},
    xaxis2: {title: 'Group', type: 'category'},
    yaxis2: {title: 'Genes'},
    height: 600,
    width: 1000
}

Plotly.newPlot("plot", data, layout)

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
    const rnaGene = RNA_DATA.filter(d=>d.ID && String(d.ID).toLowerCase()===gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0)

    if(rnaGene.length > 0){
        const times = [...new Set(rnaGene.map(d=>d.time))].sort()
        const timeLabels = times.map(t => t)
        const row = times.map(time => {
            const entry = rnaGene.find(d=>d.time === time)
            return entry ? entry["Z-score"] : 0
        })
        matrix.push(row)
        geneLabels.push(rnaGene[0].ID)
    }
})

if(matrix.length === 0){
alert("No valid genes found in selected region")
return
}

const times = [...new Set(RNA_DATA.filter(d=>d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d=>d.time))].sort()
const timeLabels = times.map(t => t)

heatmap(matrix, geneLabels, timeLabels)

}