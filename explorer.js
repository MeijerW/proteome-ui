async function plotSpatial(){

let gene =
document.getElementById("geneInput").value.toLowerCase()

let rna = await loadCSV("RNA_preprocessed.csv")
let prot = await loadCSV("Protein_preprocessed.csv")

let rnaGene =
rna.filter(d => d.Gene.toLowerCase() === gene)

let protGene =
prot.filter(d => d.Gene.toLowerCase() === gene)

let trace1 = {
x: rnaGene.map(d => d.group),
y: rnaGene.map(d => d["Z-score"]),
type: "box",
name: "RNA"
}

let trace2 = {
x: protGene.map(d => d.group),
y: protGene.map(d => d["Z-score"]),
type: "box",
name: "Protein"
}

Plotly.newPlot("plot",[trace1,trace2])

}
