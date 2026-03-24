const VIEW_PLOT_STATE = {};

function clonePlotState(value){
    return JSON.parse(JSON.stringify(value));
}

function hasRenderedPlot(){
    const plotEl = document.getElementById("plot");
    return !!(plotEl && Array.isArray(plotEl.data) && plotEl.data.length > 0);
}

function clearExplorerPlot(){
    const plotEl = document.getElementById("plot");
    if(plotEl && typeof Plotly !== "undefined"){
        Plotly.purge(plotEl);
        plotEl.innerHTML = "";
    }
    clearTemporalStatsPanel();
}

function savePlotStateForView(viewKey){
    if(!viewKey || !hasRenderedPlot()) return;

    const plotEl = document.getElementById("plot");
    const statsPanel = document.getElementById("temporalStatsPanel");
    VIEW_PLOT_STATE[viewKey] = {
        data: clonePlotState(plotEl.data),
        layout: clonePlotState(plotEl.layout || {}),
        config: clonePlotState(plotEl.config || {}),
        statsHtml: statsPanel ? statsPanel.innerHTML : "",
        statsActive: statsPanel ? statsPanel.classList.contains("active") : false
    };
}

function saveCurrentViewPlot(){
    if(typeof window.getCurrentViewKey !== "function") return;
    savePlotStateForView(window.getCurrentViewKey());
}

function restorePlotStateForView(viewKey){
    clearExplorerPlot();

    if(!viewKey || !VIEW_PLOT_STATE[viewKey]) return;

    const state = VIEW_PLOT_STATE[viewKey];
    Plotly.newPlot("plot", clonePlotState(state.data), clonePlotState(state.layout), clonePlotState(state.config));

    const statsPanel = document.getElementById("temporalStatsPanel");
    if(statsPanel){
        statsPanel.innerHTML = state.statsHtml || "";
        statsPanel.classList.toggle("active", !!state.statsActive);
    }
}

function plotSpatial(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    clearTemporalStatsPanel();

    const gene = document.getElementById("spatialGene").value.trim().toLowerCase();

    const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
    const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);

    if(rnaGene.length === 0 && protGene.length === 0){
        alert("Gene not found");
        return;
    }

    const traces = [];
    const displayGene = (rnaGene[0]?.ID || protGene[0]?.ID || gene).toUpperCase();
    const layout = {
        title: `Spatial Expression - ${displayGene}`,
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
    saveCurrentViewPlot();
}

const TEMPORAL_META_FIELDS = [
    "P_VALUE",
    "Q_VALUE",
    "PERIOD",
    "LAG",
    "AMPLITUDE",
    "OFFSET",
    "MEAN_PERIODICITY",
    "SCATTER"
];

function formatMetricValue(value){
    if(value === undefined || value === null || Number.isNaN(value)) return "-";
    if(typeof value === "number") return Number(value).toFixed(4);
    return String(value);
}

function clearTemporalStatsPanel(){
    const panel = document.getElementById("temporalStatsPanel");
    if(!panel) return;
    panel.classList.remove("active");
    panel.innerHTML = "";
}

function renderTemporalStatsPanel(gene, region, rnaGene, protGene){
    const panel = document.getElementById("temporalStatsPanel");
    if(!panel) return;

    const rnaRef = rnaGene[0] || {};
    const protRef = protGene[0] || {};

    const rows = TEMPORAL_META_FIELDS
        .map(field => `
            <tr>
                <th>${field}</th>
                <td>${formatMetricValue(rnaRef[field])}</td>
                <td>${formatMetricValue(protRef[field])}</td>
            </tr>
        `)
        .join("");

    panel.innerHTML = `
        <h4>Biocycle stats: ${gene.toUpperCase()} (${region})</h4>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>RNA</th>
                    <th>Protein</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    panel.classList.add("active");
}

function getHeatmapGeneMembership(modeId){
    const node = document.getElementById(modeId);
    return node ? node.value : "all";
}

function getAggregationMode(modeId){
    const node = document.getElementById(modeId);
    return node ? node.value : "average";
}

function getSelectedTemporalMetrics(selector = ".temporal-metric-checkbox"){ 
    return Array.from(document.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
}

function extractTemporalValueByAggregation(geneRows, time, aggregationMode, sampleKey){
    if(aggregationMode === "samples"){
        const hit = geneRows.find(d => d.sample === sampleKey);
        return hit ? hit.value : NaN;
    }

    const vals = geneRows.filter(d => d.time === time).map(d => d.value).filter(v => !Number.isNaN(v));
    if(vals.length === 0) return NaN;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function zscoreRow(values){
    const numeric = values.filter(v => !Number.isNaN(v));
    if(numeric.length < 2) return values.map(() => NaN);
    const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    const variance = numeric.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numeric.length;
    const std = Math.sqrt(variance);
    if(std === 0) return values.map(() => 0);
    return values.map(v => Number.isNaN(v) ? NaN : (v - mean) / std);
}

function getLagForSort(rnaGene, protGene){
    const vals = [];
    if(rnaGene[0] && !Number.isNaN(Number(rnaGene[0].LAG))) vals.push(Number(rnaGene[0].LAG));
    if(protGene[0] && !Number.isNaN(Number(protGene[0].LAG))) vals.push(Number(protGene[0].LAG));
    if(vals.length === 0) return Number.POSITIVE_INFINITY;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function plotTemporal(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    const gene = document.getElementById("temporalGene").value.trim().toLowerCase();
    const region = document.getElementById("region").value;

    clearTemporalStatsPanel();

    const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);
    const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);

    if(rnaGene.length === 0 && protGene.length === 0){
        alert("Gene not found in selected region");
        return;
    }

    const rnaTraces = [];
    const protTraces = [];
    const times = [30, 60, 90, 120];
    const timeLabels = times.map(String);

    // RNA traces (box + points)
    if(rnaGene.length > 0){
        times.forEach((time, idx) => {
            const yVals = rnaGene.filter(d => d.time === time).map(d => d.value);
            if(yVals.length > 0){
                rnaTraces.push({
                    x: Array(yVals.length).fill(String(time)),
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
            x: rnaGene.map(d => String(d.time)),
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
                    x: Array(yVals.length).fill(String(time)),
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
            x: protGene.map(d => String(d.time)),
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
    const displayGene = (rnaGene[0]?.ID || protGene[0]?.ID || gene).toUpperCase();

    const layout = {
        title: `Spatiotemporal Expression - ${displayGene} (${region})`,
        template: "simple_white",
        height: 600,
        width: 800,
        showlegend: true,
        legend: { orientation: 'h', y: 1.1 }
    };

    if(rnaTraces.length > 0 && protTraces.length > 0){
        layout.grid = {rows: 2, columns: 1, pattern: 'independent'};
        layout.xaxis = {title: 'Time (minutes)', type: 'category', tickmode: 'array', tickvals: timeLabels, ticktext: timeLabels};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        layout.xaxis2 = {title: 'Time (minutes)', type: 'category', tickmode: 'array', tickvals: timeLabels, ticktext: timeLabels};
        layout.yaxis2 = {title: 'LFQ', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
        protTraces.forEach(t => { t.xaxis = 'x2'; t.yaxis = 'y2'; });
    } else if(rnaTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'category', tickmode: 'array', tickvals: timeLabels, ticktext: timeLabels};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
    } else if(protTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'category', tickmode: 'array', tickvals: timeLabels, ticktext: timeLabels};
        layout.yaxis = {title: 'LFQ', automargin: true};
        protTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
    }

    Plotly.newPlot("plot", traces, layout);
    renderTemporalStatsPanel(gene, region, rnaGene, protGene);
    saveCurrentViewPlot();
}

function plotSpatialHeatmap(overrideGenes, optionsOverride = null){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    clearTemporalStatsPanel();

    const genesText = overrideGenes ? overrideGenes.join(',') : document.getElementById("spatialGenes").value.trim();
    if(!genesText){
        alert("Enter genes");
        return;
    }

    const genes = genesText.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const groups = ['Posterior', 'Anterior', 'Somite'];
    const membershipMode = optionsOverride?.membershipMode || getHeatmapGeneMembership("spatialGeneMembership");
    const aggregationMode = optionsOverride?.aggregationMode || getAggregationMode("spatialAggregation");

    const entries = [];
    genes.forEach(gene => {
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);

        const hasRna = rnaGene.length > 0;
        const hasProt = protGene.length > 0;
        if(!hasRna && !hasProt) return;
        if(membershipMode === "both" && !(hasRna && hasProt)) return;

        const getGroupValue = (arr, group) => {
            const vals = arr.filter(d => d.group === group).map(d => d["Z-score"]).filter(v => !Number.isNaN(v));
            if(vals.length === 0) return NaN;
            if(aggregationMode === "samples") return vals[0];
            return vals.reduce((a, b) => a + b, 0) / vals.length;
        };

        const rowRNA = groups.map(group => getGroupValue(rnaGene, group));
        const rowProt = groups.map(group => getGroupValue(protGene, group));
        const posteriorValues = [rowRNA[0], rowProt[0]].filter(v => !Number.isNaN(v));
        const posteriorSort = posteriorValues.length > 0
            ? posteriorValues.reduce((a, b) => a + b, 0) / posteriorValues.length
            : Number.NEGATIVE_INFINITY;

        entries.push({
            label: rnaGene[0]?.ID || protGene[0]?.ID,
            rowRNA,
            rowProt,
            posteriorSort
        });
    });

    entries.sort((a, b) => b.posteriorSort - a.posteriorSort);

    const geneLabels = entries.map(e => e.label);
    const matrixRNA = entries.map(e => e.rowRNA);
    const matrixProt = entries.map(e => e.rowProt);

    if(matrixRNA.length === 0 && matrixProt.length === 0){
        alert(membershipMode === "both"
            ? "No genes found in both RNA and Protein for current selection"
            : "No valid genes found");
        return;
    }

    const heatmapHeight = Math.max(600, 180 + (geneLabels.length * 16));
    const yTickFontSize = geneLabels.length > 250 ? 8 : (geneLabels.length > 120 ? 9 : 10);
    const yAxisBase = {
        title: 'Genes',
        type: 'category',
        automargin: true,
        tickmode: 'array',
        tickvals: geneLabels,
        ticktext: geneLabels,
        tickfont: {size: yTickFontSize},
        ticks: '',
        ticklen: 0
    };

    const data = [];
    if(matrixRNA.some(row => row.some(v => !isNaN(v)))){
        data.push({
            z: matrixRNA,
            x: groups,
            y: geneLabels,
            type: "heatmap",
            coloraxis: 'coloraxis',
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
            coloraxis: 'coloraxis',
            xaxis: data.length === 0 ? 'x' : 'x2',
            yaxis: data.length === 0 ? 'y' : 'y2'
        });
    }

    const customPlotTitle = optionsOverride?.plotTitle;

    const layout = {
        title: customPlotTitle || "Spatial Expression Heatmap",
        height: heatmapHeight,
        width: 1000,
        margin: {l: 220, r: 40, t: 90, b: 120},
        coloraxis: {
            colorscale: "Viridis",
            colorbar: {
                title: {text: "Z-score", side: "right", font: {size: 11}},
                orientation: 'v',
                x: 1.02,
                xanchor: 'left',
                y: 0.5,
                yanchor: 'middle',
                len: 0.65,
                thickness: 10
            }
        },
        annotations: []
    };

    if(data.length === 2){
        layout.grid = {rows: 1, columns: 2, pattern: 'independent'};
        layout.xaxis = {title: 'Group', type: 'category', ticks: '', ticklen: 0};
        layout.yaxis = {...yAxisBase};
        layout.xaxis2 = {title: 'Group', type: 'category', ticks: '', ticklen: 0};
        layout.yaxis2 = {...yAxisBase, title: '', showticklabels: false};
        layout.annotations = [
            {
                text: "RNA",
                x: 0.5,
                y: 1.01,
                xref: 'x domain',
                yref: 'y domain',
                showarrow: false,
                font: {size: 16}
            },
            {
                text: "Protein",
                x: 0.5,
                y: 1.01,
                xref: 'x2 domain',
                yref: 'y2 domain',
                showarrow: false,
                font: {size: 16}
            }
        ];
    } else {
        layout.xaxis = {title: 'Group', type: 'category', ticks: '', ticklen: 0};
        layout.yaxis = {...yAxisBase};
        layout.annotations = [
            {
                text: data[0] ? "RNA" : "Protein",
                x: 0.5,
                y: 1.01,
                xref: 'x domain',
                yref: 'y domain',
                showarrow: false,
                font: {size: 16}
            }
        ];
    }

    Plotly.newPlot("plot", data, layout);
    saveCurrentViewPlot();
}

// GO term helpers
const GO_TERM_GENES_CACHE = {};

function getGoIdFromInput(inputValue){
    const match = inputValue && inputValue.match(/(GO:\d{7})/i);
    return match ? match[1].toUpperCase() : null;
}

async function fetchGoTermSuggestions(query, limit = 20){
    const trimmed = String(query || "").trim();
    if(!trimmed) return { numberOfHits: 0, results: [] };

    const encodedQuery = encodeURIComponent(trimmed);
    const url = `https://www.ebi.ac.uk/QuickGO/services/ontology/go/search?query=${encodedQuery}&limit=${limit}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if(!resp.ok){
        throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return {
        numberOfHits: Number(data.numberOfHits || 0),
        results: Array.isArray(data.results) ? data.results : []
    };
}

function populateGoTermsDatalist(results){
    const datalist = document.getElementById('goTerms');
    if(!datalist) return;

    datalist.innerHTML = '';
    results.forEach(res => {
        const opt = document.createElement('option');
        opt.value = `${res.id} | ${res.name}`;
        datalist.appendChild(opt);
    });
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

    try {
        const data = await fetchGoTermSuggestions(input, 20);

        if(!data.results || data.results.length === 0){
            statusEl.textContent = "No GO terms found for that query.";
            return null;
        }

        populateGoTermsDatalist(data.results);

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
        console.info(`[GO] Using cached genes for ${goId}: ${GO_TERM_GENES_CACHE[goId].length}`);
        return GO_TERM_GENES_CACHE[goId];
    }

    const limit = 200; // QuickGO rejects larger limits (e.g. 500 -> HTTP 400)
    const symbols = new Set();
    let page = 1;
    let totalPages = 1;

    console.groupCollapsed(`[GO] Fetching genes for ${goId}`);
    while(page <= totalPages){
        const url = `https://www.ebi.ac.uk/QuickGO/services/annotation/search?goId=${encodeURIComponent(goId)}&taxonId=10090&limit=${limit}&page=${page}`;
        const resp = await fetch(url, { headers: { Accept: 'application/json' } });
        if(!resp.ok){
            const body = await resp.text();
            console.error(`[GO] QuickGO request failed for ${goId}`, { page, status: resp.status, body });
            console.groupEnd();
            throw new Error(`HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const results = data.results || [];
        results.forEach(r => {
            if(r.symbol) symbols.add(r.symbol.toLowerCase());
        });

        const hits = Number(data.numberOfHits || results.length || 0);
        totalPages = Math.max(1, Math.ceil(hits / limit));
        console.info(`[GO] ${goId} page ${page}/${totalPages}: ${results.length} annotations, ${symbols.size} unique symbols so far`);
        page += 1;
    }

    const genes = Array.from(symbols);
    GO_TERM_GENES_CACHE[goId] = genes;
    console.info(`[GO] Completed ${goId}: ${genes.length} unique symbols loaded`, genes.slice(0, 25));
    console.groupEnd();
    return genes;
}

function getDatasetGeneSet(){
    const genes = new Set();
    RNA_DATA.forEach(d => {
        if(d && d.ID) genes.add(String(d.ID).toLowerCase());
    });
    PROT_DATA.forEach(d => {
        if(d && d.ID) genes.add(String(d.ID).toLowerCase());
    });
    return genes;
}

function inspectGoGenesForDataset(goId, genes){
    const datasetGenes = getDatasetGeneSet();
    const matched = genes.filter(g => datasetGenes.has(g));
    const missing = genes.length - matched.length;
    console.info(`[GO] ${goId}: ${genes.length} symbols loaded, ${matched.length} present in current dataset, ${missing} not present`);
    return { matched, missing };
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
        const { matched, missing } = inspectGoGenesForDataset(goId, genes);
        const geneCountEl = document.getElementById('goGeneCount');
        geneCountEl.textContent = `Found ${genes.length} GO symbols; ${matched.length} are present in this dataset (${missing} absent).`;
        if(matched.length === 0){
            statusEl.textContent = `Loaded GO genes for ${goId}, but none are present in the current dataset.`;
            return;
        }
        document.getElementById('spatialGenes').value = matched.join(',');
        const goOptions = {
            membershipMode: getHeatmapGeneMembership("goSpatialGeneMembership"),
            aggregationMode: getAggregationMode("goSpatialAggregation"),
            plotTitle: `GO Term Spatial Heatmap - ${goId}`
        };
        statusEl.textContent = `Plotting ${matched.length} dataset-matched genes for GO term ${goId}...`;
        plotSpatialHeatmap(matched, goOptions);
        statusEl.textContent = `Plotted ${matched.length} dataset-matched genes for GO term ${goId}.`;
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
        const { matched, missing } = inspectGoGenesForDataset(goId, genes);
        const geneCountEl = document.getElementById('goGeneCountTemporal');
        geneCountEl.textContent = `Found ${genes.length} GO symbols; ${matched.length} are present in this dataset (${missing} absent).`;
        if(matched.length === 0){
            statusEl.textContent = `Loaded GO genes for ${goId}, but none are present in the current dataset.`;
            return;
        }
        document.getElementById('temporalGenes').value = matched.join(',');
        statusEl.textContent = `Plotting ${matched.length} dataset-matched genes for GO term ${goId}...`;
        const region = document.getElementById('goHeatmapRegion').value;
        const goOptions = {
            membershipMode: getHeatmapGeneMembership("goTemporalGeneMembership"),
            aggregationMode: getAggregationMode("goTemporalAggregation"),
            selectedMetrics: getSelectedTemporalMetrics(".go-temporal-metric-checkbox"),
            pValueFilterMode: (document.getElementById("goTemporalPValueFilter")?.value || "all"),
            plotTitle: `GO Term Spatiotemporal Heatmap - ${goId}`
        };
        plotTemporalHeatmap(matched, region, goOptions);
        statusEl.textContent = `Plotted ${matched.length} dataset-matched genes for GO term ${goId}.`;
    } catch (err){
        statusEl.textContent = `Failed to load genes for ${goId}: ${err.message}`;
    }
}

function plotTemporalHeatmap(overrideGenes, regionOverride, optionsOverride = null){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    clearTemporalStatsPanel();

    const genesText = overrideGenes ? overrideGenes.join(',') : document.getElementById("temporalGenes").value.trim();
    if(!genesText){
        alert("Enter genes");
        return;
    }

    const region = regionOverride || document.getElementById("heatmapRegion").value;
    const genes = genesText.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const aggregationMode = optionsOverride?.aggregationMode || getAggregationMode("temporalAggregation");
    const membershipMode = optionsOverride?.membershipMode || getHeatmapGeneMembership("temporalGeneMembership");
    const selectedMetrics = optionsOverride?.selectedMetrics || getSelectedTemporalMetrics();
    const pValueFilterMode = optionsOverride?.pValueFilterMode || (document.getElementById("temporalPValueFilter")?.value || "all");
    const applyPValueFilter = selectedMetrics.includes("P_VALUE") && pValueFilterMode === "significant";
    const times = [30, 60, 90, 120];

    const hasSignificantPValue = (rows) => {
        if(!rows || rows.length === 0) return false;
        return rows.some(row => {
            const p = Number(row.P_VALUE);
            return !Number.isNaN(p) && p < 0.05;
        });
    };

    const entries = [];
    genes.forEach(gene => {
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0);
        const hasRna = rnaGene.length > 0;
        const hasProt = protGene.length > 0;
        if(!hasRna && !hasProt) return;
        if(membershipMode === "both" && !(hasRna && hasProt)) return;
        if(applyPValueFilter && !(hasSignificantPValue(rnaGene) || hasSignificantPValue(protGene))) return;

        entries.push({
            gene,
            label: rnaGene[0]?.ID || protGene[0]?.ID,
            rnaGene,
            protGene,
            lagSort: getLagForSort(rnaGene, protGene)
        });
    });

    entries.sort((a, b) => a.lagSort - b.lagSort);

    if(entries.length === 0){
        if(applyPValueFilter){
            alert("No genes passed the P_VALUE < 0.05 filter in selected region");
            return;
        }
        alert(membershipMode === "both"
            ? "No genes found in both RNA and Protein for current selection"
            : "No valid genes found in selected region");
        return;
    }

    const geneLabels = entries.map(e => e.label);
    const rnaHasData = entries.some(e => e.rnaGene.length > 0);
    const protHasData = entries.some(e => e.protGene.length > 0);

    let xLabels = times;
    let xDisplayLabels = times.map(String);
    if(aggregationMode === "samples"){
        const sampleSet = new Set();
        entries.forEach(e => {
            e.rnaGene.forEach(d => sampleSet.add(d.sample));
            e.protGene.forEach(d => sampleSet.add(d.sample));
        });
        xLabels = Array.from(sampleSet).sort((a, b) => {
            const pa = /TP_(\d+)_REP_(\d+)/.exec(a) || [null, 0, 0];
            const pb = /TP_(\d+)_REP_(\d+)/.exec(b) || [null, 0, 0];
            if(Number(pa[1]) !== Number(pb[1])) return Number(pa[1]) - Number(pb[1]);
            return Number(pa[2]) - Number(pb[2]);
        });
        xDisplayLabels = [...xLabels];
    }

    const buildExprMatrix = (datasetKey) => entries.map(e => {
        const rows = datasetKey === "RNA" ? e.rnaGene : e.protGene;
        const raw = xLabels.map(label => {
            if(aggregationMode === "samples"){
                return extractTemporalValueByAggregation(rows, null, "samples", label);
            }
            return extractTemporalValueByAggregation(rows, label, "average", null);
        });
        return zscoreRow(raw);
    });

    const matrixRNA = buildExprMatrix("RNA");
    const matrixProt = buildExprMatrix("Protein");

    const metricColorScale = (metric) => {
        if(metric === "P_VALUE" || metric === "Q_VALUE"){
            return [[0, "#5b2a86"], [1, "#ffffff"]];
        }
        if(metric === "LAG"){
            return [[0, "#0b3c5d"], [0.5, "#328cc1"], [1, "#d9b310"]];
        }
        if(metric === "PERIOD"){
            // Ideal PERIOD is 130 min (distance=0); farther values shift away in color.
            return [[0, "#2ca25f"], [0.5, "#fdd049"], [1, "#6a3d9a"]];
        }
        return "Plasma";
    };

    const getMetricZValues = (metric, metricValues) => {
        if(metric === "PERIOD"){
            return metricValues.map(v => Number.isNaN(v) ? NaN : Math.abs(v - 130));
        }
        return metricValues;
    };

    const getMetricScaleConfig = (metric) => {
        if(metric === "P_VALUE" || metric === "Q_VALUE"){
            return { zmin: 0, zmax: 1, zauto: false, colorbarTitle: metric };
        }
        if(metric === "LAG"){
            return { zmin: 0, zmax: 120, zauto: false, colorbarTitle: "LAG (0-120 min)" };
        }
        if(metric === "PERIOD"){
            return { zmin: 0, zmax: 70, zauto: false, colorbarTitle: "|PERIOD - 130| (min)" };
        }
        return { zmin: undefined, zmax: undefined, zauto: true, colorbarTitle: metric };
    };

    const buildMetricColumn = (datasetKey, metric) => entries.map(e => {
        const rows = datasetKey === "RNA" ? e.rnaGene : e.protGene;
        const ref = rows[0] || {};
        const val = Number(ref[metric]);
        return Number.isNaN(val) ? NaN : val;
    });

    const formatMetricCell = (value) => {
        if(Number.isNaN(value)) return "";
        const abs = Math.abs(value);
        if(abs > 0 && abs < 0.001) return Number(value).toExponential(2);
        return Number(value).toFixed(3);
    };

    const subplots = [];
    if(rnaHasData){
        subplots.push({dataset: "RNA", kind: "expr", title: "RNA"});
        selectedMetrics.forEach(metric => subplots.push({dataset: "RNA", kind: "metric", metric, title: `RNA ${metric}`}));
    }
    if(protHasData){
        subplots.push({dataset: "Protein", kind: "expr", title: "Protein"});
        selectedMetrics.forEach(metric => subplots.push({dataset: "Protein", kind: "metric", metric, title: `Protein ${metric}`}));
    }

    const heatmapHeight = Math.max(320, 120 + (geneLabels.length * 14));
    const yTickFontSize = geneLabels.length > 250 ? 8 : (geneLabels.length > 120 ? 9 : 10);
    const baseColumnGap = 0.012;
    const weights = subplots.map(slot => {
        if(slot.kind === "expr") return 2;
        if(slot.metric === "P_VALUE" || slot.metric === "Q_VALUE") return 0.7;
        return 1;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const subplotCount = subplots.length;
    const gapSlots = Math.max(0, subplotCount - 1);
    let effectiveColumnGap = gapSlots > 0 ? baseColumnGap : 0;
    if(gapSlots > 0 && (effectiveColumnGap * gapSlots) >= 1){
        // If many subplots are selected, shrink inter-column gaps to keep domains valid.
        effectiveColumnGap = 0.98 / gapSlots;
    }
    const totalGap = effectiveColumnGap * gapSlots;
    const usableDomain = Math.max(0.02, 1 - totalGap);
    const subDomains = [];
    let cursor = 0;
    for(let i = 0; i < subplots.length; i++){
        const width = usableDomain * (weights[i] / totalWeight);
        const end = Math.min(1, cursor + width);
        subDomains.push([cursor, end]);
        cursor = end + effectiveColumnGap;
    }

    const customPlotTitle = optionsOverride?.plotTitle;

    const layout = {
        title: customPlotTitle || `Spatiotemporal Expression Heatmap - ${region}`,
        height: heatmapHeight,
        width: Math.max(900, 220 + (weights.reduce((sum, w) => sum + (w * 170), 0))),
        margin: {l: 230, r: 40, t: 95, b: 210},
        annotations: []
    };

    const buildDomainColorbar = (domain, titleText) => {
        const domainCenter = (domain[0] + domain[1]) / 2;
        const domainWidth = Math.max(0.06, domain[1] - domain[0]);
        return {
            title: {text: titleText, side: 'top', font: {size: 10}},
            orientation: 'h',
            x: domainCenter,
            xanchor: 'center',
            y: -0.2,
            yanchor: 'top',
            len: Math.max(0.06, domainWidth * 0.88),
            thickness: 8
        };
    };

    const traces = [];
    subplots.forEach((slot, i) => {
        const axisIndex = i + 1;
        const xKey = axisIndex === 1 ? "x" : `x${axisIndex}`;
        const yKey = axisIndex === 1 ? "y" : `y${axisIndex}`;
        const layoutXKey = axisIndex === 1 ? "xaxis" : `xaxis${axisIndex}`;
        const layoutYKey = axisIndex === 1 ? "yaxis" : `yaxis${axisIndex}`;
        const domain = subDomains[i];
        const isExpression = slot.kind === "expr";

        layout[layoutXKey] = {
            title: isExpression
                ? (aggregationMode === "samples" ? "Sample" : "Time (minutes)")
                : '',
            type: 'category',
            tickangle: isExpression ? 0 : -45,
            tickmode: isExpression ? 'array' : undefined,
            tickvals: isExpression ? xDisplayLabels : undefined,
            ticktext: isExpression ? xDisplayLabels : undefined,
            showticklabels: isExpression,
            ticks: '',
            ticklen: 0,
            domain,
            anchor: yKey
        };
        layout[layoutYKey] = {
            title: i === 0 ? 'Genes' : '',
            type: 'category',
            automargin: true,
            tickmode: 'array',
            tickvals: geneLabels,
            ticktext: geneLabels,
            categoryorder: 'array',
            categoryarray: geneLabels,
            showticklabels: i === 0,
            tickfont: {size: yTickFontSize},
            ticks: '',
            ticklen: 0,
            domain: [0, 1],
            anchor: xKey,
            ticklabeloverflow: 'allow',
            matches: axisIndex === 1 ? undefined : 'y'
        };

        if(isExpression){
            traces.push({
                z: slot.dataset === "RNA" ? matrixRNA : matrixProt,
                x: xDisplayLabels,
                y: geneLabels,
                type: "heatmap",
                colorscale: "Viridis",
                xaxis: xKey,
                yaxis: yKey,
                zmin: -2,
                zmax: 2,
                colorbar: buildDomainColorbar(domain, 'Z-score')
            });
        } else {
            const metricValues = buildMetricColumn(slot.dataset, slot.metric);
            const metricZValues = getMetricZValues(slot.metric, metricValues);
            const scaleConfig = getMetricScaleConfig(slot.metric);
            const metricText = metricValues.map(v => formatMetricCell(v));
            traces.push({
                z: metricZValues.map(v => [v]),
                x: [slot.metric],
                y: geneLabels,
                type: "heatmap",
                colorscale: metricColorScale(slot.metric),
                xaxis: xKey,
                yaxis: yKey,
                zmin: scaleConfig.zmin,
                zmax: scaleConfig.zmax,
                zauto: scaleConfig.zauto,
                text: metricText.map(v => [v]),
                texttemplate: "%{text}",
                textfont: {size: 10, color: "#111"},
                customdata: metricValues.map(v => [v]),
                hovertemplate: slot.metric === "PERIOD"
                    ? "%{y}<br>PERIOD: %{customdata[0]:.3f}<br>|Δ130|: %{z:.3f}<extra></extra>"
                    : "%{y}<br>" + slot.metric + ": %{customdata[0]:.3f}<extra></extra>",
                colorbar: buildDomainColorbar(domain, scaleConfig.colorbarTitle)
            });

            // Keep numeric values visible regardless of heatmap text rendering support
            traces.push({
                x: Array(geneLabels.length).fill(slot.metric),
                y: geneLabels,
                type: "scatter",
                mode: "text",
                text: metricText,
                textfont: {size: 10, color: "#111"},
                hoverinfo: "skip",
                showlegend: false,
                xaxis: xKey,
                yaxis: yKey
            });
        }

        layout.annotations.push({
            text: `<b>${slot.title}</b>`,
            x: 0.5,
            y: 1.01,
            xref: `${xKey} domain`,
            yref: `${yKey} domain`,
            showarrow: false,
            font: {size: 13}
        });
    });

    Plotly.newPlot("plot", traces, layout);
    saveCurrentViewPlot();
}

// Expose key functions to the global scope (for inline onclick handlers)
window.searchGoTerm = searchGoTerm;
window.plotGoSpatialHeatmap = plotGoSpatialHeatmap;
window.plotGoTemporalHeatmap = plotGoTemporalHeatmap;
window.plotSpatial = plotSpatial;
window.plotSpatialHeatmap = plotSpatialHeatmap;
window.plotTemporal = plotTemporal;
window.plotTemporalHeatmap = plotTemporalHeatmap;
window.fetchGoTermSuggestions = fetchGoTermSuggestions;
window.populateGoTermsDatalist = populateGoTermsDatalist;
window.clearExplorerPlot = clearExplorerPlot;
window.restorePlotStateForView = restorePlotStateForView;
window.savePlotStateForView = savePlotStateForView;
