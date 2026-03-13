async function spatialPlot(gene){

    const rna = await loadCSV("RNA_preprocessed.csv")
    const prot = await loadCSV("Protein_preprocessed.csv")

    const rnaGene =
        rna.filter(d =>
            d.Gene.toLowerCase() === gene
        )

    const protGene =
        prot.filter(d =>
            d.Gene.toLowerCase() === gene
        )

    if(rnaGene.length === 0 && protGene.length === 0){
        alert("Gene not found")
        return
    }

    const trace1 = {
        x: rnaGene.map(d=>d.group),
        y: rnaGene.map(d=>d["Z-score"]),
        type: "box",
        name: "RNA",
        marker:{color:"#d5af34"}
    }

    const trace2 = {
        x: protGene.map(d=>d.group),
        y: protGene.map(d=>d["Z-score"]),
        type: "box",
        name: "Protein",
        marker:{color:"#8281be"}
    }

    Plotly.newPlot(
        "plot",
        [trace1,trace2],
        {
            title:`Spatial Expression: ${gene}`,
            boxmode:"group",
            template:"simple_white",
            height:500
        }
    )
}