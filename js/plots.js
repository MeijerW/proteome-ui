function plotSpatial(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const gene = document.getElementById("spatialGene").value.trim().toLowerCase();

    const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
    const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);

    if(rnaGene.length === 0 && protGene.length === 0){
        alert("Gene not found");
        return;
    }

    const traces = [];
    const layout = {
        title: "Spatial Expression",
        template: "simple_white",
        height: 600,
        width: 800
    };

    const order = ['Posterior', 'Anterior', 'Somite'];

    if(rnaGene.length > 0){
        rnaGene.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
        traces.push({
            x: rnaGene.map(d => d.group),
            y: rnaGene.map(d => d["Z-score"]),
            type: "box",
            name: "RNA",
            marker: {color: "#d5af34"}
        });
    }

    if(protGene.length > 0){
        protGene.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
        traces.push({
            x: protGene.map(d => d.group),
            y: protGene.map(d => d["Z-score"]),
            type: "box",
            name: "Protein",
            marker: {color: "#8281be"}
        });
    }

    if(traces.length === 2){
        layout.grid = {rows: 2, columns: 1, pattern: 'independent'};
        layout.xaxis = {title: 'Group'};
        layout.yaxis = {title: 'Z-score'};
        layout.xaxis2 = {title: 'Group'};
        layout.yaxis2 = {title: 'Z-score'};
        traces[0].xaxis = 'x';
        traces[0].yaxis = 'y';
        traces[1].xaxis = 'x2';
        traces[1].yaxis = 'y2';
    } else {
        layout.xaxis = {title: 'Group'};
        layout.yaxis = {title: 'Z-score'};
    }

    Plotly.newPlot("plot", traces, layout);
}

function plotTemporal(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const gene = document.getElementById("temporalGene").value.trim().toLowerCase();
    const region = document.getElementById("region").value;

    const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);
    const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);

    if(rnaGene.length === 0 && protGene.length === 0){
        alert("Gene not found in selected region");
        return;
    }

    const rnaTraces = [];
    const protTraces = [];
    const times = [30, 60, 90, 120];

    // RNA traces (box + points)
    if(rnaGene.length > 0){
        times.forEach((time, idx) => {
            const yVals = rnaGene.filter(d => d.time === time).map(d => d.value);
            if(yVals.length > 0){
                rnaTraces.push({
                    x: Array(yVals.length).fill(time),
                    y: yVals,
                    type: "box",
                    name: "RNA",
                    legendgroup: "RNA",
                    showlegend: idx === 0,
                    marker: {color: "#d5af34"},
                    boxmean: true,
                    boxpoints: false
                });
            }
        });
        // Stripplot points
        rnaTraces.push({
            x: rnaGene.map(d => d.time),
            y: rnaGene.map(d => d.value),
            mode: "markers",
            type: "scatter",
            name: "RNA points",
            legendgroup: "RNA",
            showlegend: false,
            marker: {color: "#d5af34", size: 6, opacity: 0.8}
        });
    }

    // Protein traces (box + points)
    if(protGene.length > 0){
        times.forEach((time, idx) => {
            const yVals = protGene.filter(d => d.time === time).map(d => d.value);
            if(yVals.length > 0){
                protTraces.push({
                    x: Array(yVals.length).fill(time),
                    y: yVals,
                    type: "box",
                    name: "Protein",
                    legendgroup: "Protein",
                    showlegend: idx === 0,
                    marker: {color: "#8281be"},
                    boxmean: true,
                    boxpoints: false
                });
            }
        });
        protTraces.push({
            x: protGene.map(d => d.time),
            y: protGene.map(d => d.value),
            mode: "markers",
            type: "scatter",
            name: "Protein points",
            legendgroup: "Protein",
            showlegend: false,
            marker: {color: "#8281be", size: 6, opacity: 0.8}
        });
    }

    const traces = [...rnaTraces, ...protTraces];

    const layout = {
        title: `Spatiotemporal Expression - ${region}`,
        template: "simple_white",
        height: 600,
        width: 800,
        showlegend: true,
        legend: { orientation: 'h', y: 1.1 }
    };

    if(rnaTraces.length > 0 && protTraces.length > 0){
        layout.grid = {rows: 2, columns: 1, pattern: 'independent'};
        layout.xaxis = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        layout.xaxis2 = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis2 = {title: 'LFQ', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
        protTraces.forEach(t => { t.xaxis = 'x2'; t.yaxis = 'y2'; });
    } else if(rnaTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
    } else if(protTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis = {title: 'LFQ', automargin: true};
        protTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
    }

    Plotly.newPlot("plot", traces, layout);
}

function plotSpatialHeatmap(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const genesText = document.getElementById("spatialGenes").value.trim();
    if(!genesText){
        alert("Enter genes");
        return;
    }

    const genes = genesText.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const groups = ['Posterior', 'Anterior', 'Somite'];

    const matrixRNA = [];
    const matrixProt = [];
    const geneLabels = [];

    genes.forEach(gene => {
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
        if(rnaGene.length > 0 || protGene.length > 0){
            const rowRNA = groups.map(group => {
                const entry = rnaGene.find(d => d.group === group);
                return entry ? entry["Z-score"] : NaN;
            });
            matrixRNA.push(rowRNA);
            const rowProt = groups.map(group => {
                const entry = protGene.find(d => d.group === group);
                return entry ? entry["Z-score"] : NaN;
            });
            matrixProt.push(rowProt);
            geneLabels.push(rnaGene[0]?.ID || protGene[0]?.ID);
        }
    });

    if(matrixRNA.length === 0 && matrixProt.length === 0){
        alert("No valid genes found");
        return;
    }

    const data = [];
    if(matrixRNA.some(row => row.some(v => !isNaN(v)))){
        data.push({
            z: matrixRNA,
            x: groups,
            y: geneLabels,
            type: "heatmap",
            colorscale: "Viridis",
            xaxis: 'x',
            yaxis: 'y'
        });
    }
    if(matrixProt.some(row => row.some(v => !isNaN(v)))){
        data.push({
            z: matrixProt,
            x: groups,
            y: geneLabels,
            type: "heatmap",
            colorscale: "Viridis",
            xaxis: data.length === 0 ? 'x' : 'x2',
            yaxis: data.length === 0 ? 'y' : 'y2'
        });
    }

    const layout = {
        title: "Spatial Expression Heatmap",
        height: 600,
        width: 1000,
        annotations: []
    };

    if(data.length === 2){
        layout.grid = {rows: 1, columns: 2, pattern: 'independent'};
        layout.xaxis = {title: 'Group', type: 'category'};
        layout.yaxis = {title: 'Genes'};
        layout.xaxis2 = {title: 'Group', type: 'category'};
        layout.yaxis2 = {title: 'Genes'};
        layout.annotations = [
            {
                text: "RNA",
                x: 0.25,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            },
            {
                text: "Protein",
                x: 0.75,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            }
        ];
    } else {
        layout.xaxis = {title: 'Group', type: 'category'};
        layout.yaxis = {title: 'Genes'};
        layout.annotations = [
            {
                text: data[0] ? "RNA" : "Protein",
                x: 0.5,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            }
        ];
    }

    Plotly.newPlot("plot", data, layout);
}

function plotTemporalHeatmap(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const genesText = document.getElementById("temporalGenes").value.trim();
    if(!genesText){
        alert("Enter genes");
        return;
    }

    const region = document.getElementById("heatmapRegion").value;
    const genes = genesText.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const times = [30, 60, 90, 120];

    const matrixRNA = [];
    const matrixProt = [];
    const geneLabels = [];

    genes.forEach(gene => {
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);

        if(rnaGene.length > 0 || protGene.length > 0){
            // Compute Z-scores for RNA
            if(rnaGene.length > 0){
                const allValues = rnaGene.map(d => d.value);
                const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
                const std = Math.sqrt(allValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allValues.length);
                const rowRNA = times.map(time => {
                    const entry = rnaGene.find(d => d.time === time);
                    return entry ? (entry.value - mean) / std : NaN;
                });
                matrixRNA.push(rowRNA);
            } else {
                matrixRNA.push(times.map(() => NaN));
            }

            // Compute Z-scores for Protein
            if(protGene.length > 0){
                const allValues = protGene.map(d => d.value);
                const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
                const std = Math.sqrt(allValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allValues.length);
                const rowProt = times.map(time => {
                    const entry = protGene.find(d => d.time === time);
                    return entry ? (entry.value - mean) / std : NaN;
                });
                matrixProt.push(rowProt);
            } else {
                matrixProt.push(times.map(() => NaN));
            }

            geneLabels.push(rnaGene[0]?.ID || protGene[0]?.ID);
        }
    });

    if(matrixRNA.length === 0 && matrixProt.length === 0){
        alert("No valid genes found in selected region");
        return;
    }

    const data = [];
    if(matrixRNA.some(row => row.some(v => !isNaN(v)))){
        data.push({
            z: matrixRNA,
            x: times,
            y: geneLabels,
            type: "heatmap",
            colorscale: "Viridis",
            xaxis: 'x',
            yaxis: 'y'
        });
    }
    if(matrixProt.some(row => row.some(v => !isNaN(v)))){
        data.push({
            z: matrixProt,
            x: times,
            y: geneLabels,
            type: "heatmap",
            colorscale: "Viridis",
            xaxis: data.length === 0 ? 'x' : 'x2',
            yaxis: data.length === 0 ? 'y' : 'y2'
        });
    }

    const layout = {
        title: `Spatiotemporal Expression Heatmap - ${region}`,
        height: 600,
        width: 1000,
        annotations: []
    };

    if(data.length === 2){
        layout.grid = {rows: 1, columns: 2, pattern: 'independent'};
        layout.xaxis = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis = {title: 'Genes'};
        layout.xaxis2 = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis2 = {title: 'Genes'};
        layout.annotations = [
            {
                text: "RNA",
                x: 0.25,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            },
            {
                text: "Protein",
                x: 0.75,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            }
        ];
    } else {
        layout.xaxis = {title: 'Time (minutes)', type: 'category'};
        layout.yaxis = {title: 'Genes'};
        layout.annotations = [
            {
                text: data[0] ? "RNA" : "Protein",
                x: 0.5,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 16}
            }
        ];
    }

    Plotly.newPlot("plot", data, layout);
}