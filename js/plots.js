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

function plotSpatialHeatmap(overrideGenes){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const genesText = overrideGenes ? overrideGenes.join(',') : document.getElementById("spatialGenes").value.trim();
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

// GO term helpers
const GO_TERM_GENES_CACHE = {};

function getGoIdFromInput(inputValue){
    const match = inputValue && inputValue.match(/(GO:\d{7})/i);
    return match ? match[1].toUpperCase() : null;
}

async function searchGoTerm(forTemporal = false){
    const inputId = forTemporal ? 'goTermInputTemporal' : 'goTermInput';
    const statusId = forTemporal ? 'goSearchStatusTemporal' : 'goSearchStatus';
    const input = document.getElementById(inputId).value.trim();
    const statusEl = document.getElementById(statusId);

    const goId = getGoIdFromInput(input);
    if(goId){
        statusEl.textContent = `Using GO term ${goId}. Click "Generate" to plot.`;
        // Keep both input fields in sync
        document.getElementById('goTermInput').value = goId;
        document.getElementById('goTermInputTemporal').value = goId;
        return goId;
    }

    if(!input){
        statusEl.textContent = "Enter a GO term ID or keyword to search.";
        return null;
    }

    statusEl.textContent = "Searching GO terms...";
    const query = encodeURIComponent(input);
    const url = `https://www.ebi.ac.uk/QuickGO/services/ontology/go/search?query=${query}&limit=20`;

    try {
        const resp = await fetch(url);
        if(!resp.ok){
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const datalist = document.getElementById('goTerms');
        datalist.innerHTML = '';

        if(!data.results || data.results.length === 0){
            statusEl.textContent = "No GO terms found for that query.";
            return null;
        }

        data.results.forEach(res => {
            const opt = document.createElement('option');
            opt.value = `${res.id} | ${res.name}`;
            datalist.appendChild(opt);
        });

        statusEl.textContent = `Found ${data.numberOfHits} terms (showing ${data.results.length}). Select one from the dropdown.`;
        document.getElementById(inputId).value = `${data.results[0].id} | ${data.results[0].name}`;
        if(!forTemporal){
            document.getElementById('goTermInputTemporal').value = document.getElementById(inputId).value;
        } else {
            document.getElementById('goTermInput').value = document.getElementById(inputId).value;
        }
        return getGoIdFromInput(document.getElementById(inputId).value);
    } catch (err){
        statusEl.textContent = `GO search failed: ${err.message}`;
        return null;
    }
}

async function fetchGoTermGenes(goId){
    if(GO_TERM_GENES_CACHE[goId]){
        return GO_TERM_GENES_CACHE[goId];
    }

    const url = `https://www.ebi.ac.uk/QuickGO/services/annotation/search?goId=${encodeURIComponent(goId)}&taxonId=10090&limit=500&aspect=biological_process,molecular_function,cellular_component`;
    const resp = await fetch(url);
    if(!resp.ok){
        throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const symbols = new Set();
    (data.results || []).forEach(r => {
        if(r.symbol) symbols.add(r.symbol.toLowerCase());
        else if(r.geneProductId) symbols.add(r.geneProductId.toLowerCase());
    });
    const genes = Array.from(symbols);
    GO_TERM_GENES_CACHE[goId] = genes;
    return genes;
}

async function plotGoSpatialHeatmap(){
    const goId = getGoIdFromInput(document.getElementById('goTermInput').value);
    if(!goId){
        alert('Please enter or select a valid GO term ID (e.g. GO:0007049).');
        return;
    }

    const statusEl = document.getElementById('goSearchStatus');
    statusEl.textContent = 'Loading gene list for ' + goId + '...';

    try {
        const genes = await fetchGoTermGenes(goId);
        const geneCountEl = document.getElementById('goGeneCount');
        geneCountEl.textContent = `Found ${genes.length} unique gene symbols (mouse) for ${goId}.`; 
        document.getElementById('spatialGenes').value = genes.join(',');
        statusEl.textContent = `Plotting ${genes.length} genes for GO term ${goId}...`;
        plotSpatialHeatmap(genes);
        statusEl.textContent = `Plotted ${genes.length} genes for GO term ${goId}.`;
    } catch (err){
        statusEl.textContent = `Failed to load genes for ${goId}: ${err.message}`;
    }
}

async function plotGoTemporalHeatmap(){
    const goId = getGoIdFromInput(document.getElementById('goTermInputTemporal').value);
    if(!goId){
        alert('Please enter or select a valid GO term ID (e.g. GO:0007049).');
        return;
    }

    const statusEl = document.getElementById('goSearchStatusTemporal');
    statusEl.textContent = 'Loading gene list for ' + goId + '...';

    try {
        const genes = await fetchGoTermGenes(goId);
        const geneCountEl = document.getElementById('goGeneCountTemporal');
        geneCountEl.textContent = `Found ${genes.length} unique gene symbols (mouse) for ${goId}.`;
        document.getElementById('temporalGenes').value = genes.join(',');
        statusEl.textContent = `Plotting ${genes.length} genes for GO term ${goId}...`;
        const region = document.getElementById('goHeatmapRegion').value;
        plotTemporalHeatmap(genes, region);
        statusEl.textContent = `Plotted ${genes.length} genes for GO term ${goId}.`;
    } catch (err){
        statusEl.textContent = `Failed to load genes for ${goId}: ${err.message}`;
    }
}

function plotTemporalHeatmap(overrideGenes, regionOverride){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const genesText = overrideGenes ? overrideGenes.join(',') : document.getElementById("temporalGenes").value.trim();
    if(!genesText){
        alert("Enter genes");
        return;
    }

    const region = regionOverride || document.getElementById("heatmapRegion").value;
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