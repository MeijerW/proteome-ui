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

function getBiocycleFitParams(rows){
    if(!Array.isArray(rows) || rows.length === 0) return null;
    for(const row of rows){
        const period = Number(row.PERIOD);
        const lag = Number(row.LAG);
        const amplitude = Number(row.AMPLITUDE);
        const offset = Number(row.OFFSET);
        if(Number.isNaN(period) || period === 0) continue;
        if(Number.isNaN(lag) || Number.isNaN(amplitude) || Number.isNaN(offset)) continue;
        const pValue = Number(row.P_VALUE);
        const qValue = Number(row.Q_VALUE);
        return {
            period,
            lag,
            amplitude,
            offset,
            pValue: Number.isNaN(pValue) ? null : pValue,
            qValue: Number.isNaN(qValue) ? null : qValue
        };
    }
    return null;
}

function buildBiocycleFitTrace(rows, datasetLabel, lineColor){
    const params = getBiocycleFitParams(rows);
    if(!params) return null;

    const timeFine = Array.from({length: 151}, (_, i) => i);
    const fittedValues = timeFine.map(t => {
        return params.amplitude * Math.cos((2 * Math.PI * (t - params.lag)) / params.period) + params.offset;
    });

    const pText = params.pValue === null ? "" : `, p=${params.pValue.toFixed(4)}`;
    const qText = params.qValue === null ? "" : `, q=${params.qValue.toFixed(4)}`;

    return {
        x: timeFine,
        y: fittedValues,
        mode: "lines",
        type: "scatter",
        name: `${datasetLabel} BioCycle fit${pText}${qText}`,
        legendgroup: datasetLabel,
        showlegend: true,
        line: {
            color: lineColor,
            width: 2.5
        },
        hovertemplate: `${datasetLabel} BioCycle fit<br>Time: %{x:.1f} min<br>Fitted: %{y:.3f}<extra></extra>`
    };
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
    const showSineFit = !!document.getElementById("temporalShowSineFit")?.checked;

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
            x: rnaGene.map(d => Number(d.time)),
            y: rnaGene.map(d => d.value),
            mode: "markers",
            type: "scatter",
            name: "RNA points",
            legendgroup: "RNA",
            showlegend: false,
            marker: {color: "#d5af34", size: 6, opacity: 0.8}
        });

        if(showSineFit){
            const rnaFit = buildBiocycleFitTrace(rnaGene, "RNA", "#8c6d1f");
            if(rnaFit) rnaTraces.push(rnaFit);
        }
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
            x: protGene.map(d => Number(d.time)),
            y: protGene.map(d => d.value),
            mode: "markers",
            type: "scatter",
            name: "Protein points",
            legendgroup: "Protein",
            showlegend: false,
            marker: {color: "#8281be", size: 6, opacity: 0.8}
        });

        if(showSineFit){
            const protFit = buildBiocycleFitTrace(protGene, "Protein", "#4f4e8f");
            if(protFit) protTraces.push(protFit);
        }
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
        layout.xaxis = {title: 'Time (minutes)', type: 'linear', tickmode: 'array', tickvals: times, ticktext: timeLabels, range: [0, 150]};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        layout.xaxis2 = {title: 'Time (minutes)', type: 'linear', tickmode: 'array', tickvals: times, ticktext: timeLabels, range: [0, 150]};
        layout.yaxis2 = {title: 'LFQ', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
        protTraces.forEach(t => { t.xaxis = 'x2'; t.yaxis = 'y2'; });
    } else if(rnaTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'linear', tickmode: 'array', tickvals: times, ticktext: timeLabels, range: [0, 150]};
        layout.yaxis = {title: 'Normalized Count', automargin: true};
        rnaTraces.forEach(t => { t.xaxis = 'x'; t.yaxis = 'y'; });
    } else if(protTraces.length > 0){
        layout.xaxis = {title: 'Time (minutes)', type: 'linear', tickmode: 'array', tickvals: times, ticktext: timeLabels, range: [0, 150]};
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

    const toZScore = (row) => Number(row["Z-score"]);
    const mean = (vals) => vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : NaN;

    const entries = [];
    genes.forEach(gene => {
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && !d.time);

        const hasRna = rnaGene.length > 0;
        const hasProt = protGene.length > 0;
        if(!hasRna && !hasProt) return;
        if(membershipMode === "both" && !(hasRna && hasProt)) return;

        const posteriorRNA = mean(rnaGene.filter(d => d.group === 'Posterior').map(toZScore).filter(v => !Number.isNaN(v)));
        const posteriorProt = mean(protGene.filter(d => d.group === 'Posterior').map(toZScore).filter(v => !Number.isNaN(v)));
        const posteriorValues = [posteriorRNA, posteriorProt].filter(v => !Number.isNaN(v));
        const posteriorSort = posteriorValues.length > 0 ? mean(posteriorValues) : Number.NEGATIVE_INFINITY;

        entries.push({
            label: rnaGene[0]?.ID || protGene[0]?.ID,
            rnaGene,
            protGene,
            posteriorSort
        });
    });

    entries.sort((a, b) => b.posteriorSort - a.posteriorSort);

    // Spatial CSV rows do not carry explicit sample IDs. In sample mode we therefore
    // expose the original per-group values by replicate slot (REP_1..REP_n).
    const replicateCountByGroup = groups.reduce((acc, group) => {
        let maxCount = 0;
        entries.forEach(e => {
            const rnaCount = e.rnaGene.filter(row => row.group === group).length;
            const protCount = e.protGene.filter(row => row.group === group).length;
            maxCount = Math.max(maxCount, rnaCount, protCount);
        });
        acc[group] = Math.max(1, maxCount);
        return acc;
    }, {});

    const xLabels = aggregationMode === "samples"
        ? groups.flatMap(group => Array.from(
            {length: replicateCountByGroup[group]},
            (_, idx) => `${group} | REP_${idx + 1}`
        ))
        : [...groups];

    const getMeanByGroup = (rows, group) => {
        const vals = rows.filter(d => d.group === group).map(toZScore).filter(v => !Number.isNaN(v));
        return mean(vals);
    };

    const getReplicateValue = (rows, group, repIndex) => {
        const vals = rows
            .filter(d => d.group === group)
            .map(toZScore)
            .filter(v => !Number.isNaN(v));
        return repIndex < vals.length ? vals[repIndex] : NaN;
    };

    const buildRow = (rows) => {
        if(aggregationMode !== "samples"){
            return groups.map(group => getMeanByGroup(rows, group));
        }
        return xLabels.map(label => {
            const parts = String(label).split(' | ');
            if(parts.length < 2) return getMeanByGroup(rows, parts[0]);
            const group = parts[0];
            const repLabel = parts.slice(1).join(' | ');
            const repMatch = repLabel.match(/REP_(\d+)$/);
            const repIndex = repMatch ? (Number(repMatch[1]) - 1) : 0;
            return getReplicateValue(rows, group, repIndex);
        });
    };

    const geneLabels = entries.map(e => e.label);
    const matrixRNA = entries.map(e => buildRow(e.rnaGene));
    const matrixProt = entries.map(e => buildRow(e.protGene));

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
            x: xLabels,
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
            x: xLabels,
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
        width: aggregationMode === "samples" ? Math.max(1000, 260 + (xLabels.length * 85)) : 1000,
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
        layout.xaxis = {title: aggregationMode === "samples" ? 'Sample' : 'Group', type: 'category', tickangle: aggregationMode === "samples" ? -45 : 0, ticks: '', ticklen: 0};
        layout.yaxis = {...yAxisBase};
        layout.xaxis2 = {title: aggregationMode === "samples" ? 'Sample' : 'Group', type: 'category', tickangle: aggregationMode === "samples" ? -45 : 0, ticks: '', ticklen: 0};
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
        layout.xaxis = {title: aggregationMode === "samples" ? 'Sample' : 'Group', type: 'category', tickangle: aggregationMode === "samples" ? -45 : 0, ticks: '', ticklen: 0};
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

// Fetch all gene annotations for a GO term. Remaining pages after page 1 are fetched
// in parallel for a significant speedup over sequential fetching.
// onProgress({done, total, symbols, cached}) is called after page 1 and when all pages finish.
async function fetchGoTermGenes(goId, onProgress = null){
    if(GO_TERM_GENES_CACHE[goId]){
        const cached = GO_TERM_GENES_CACHE[goId];
        console.info(`[GO] Using cached genes for ${goId}: ${cached.length}`);
        if(onProgress) onProgress({done: 1, total: 1, symbols: cached.length, cached: true});
        return cached;
    }

    const limit = 200; // QuickGO rejects larger limits (e.g. 500 -> HTTP 400)
    const symbols = new Set();
    const buildUrl = (p) => `https://www.ebi.ac.uk/QuickGO/services/annotation/search?goId=${encodeURIComponent(goId)}&taxonId=10090&limit=${limit}&page=${p}`;

    // Fetch page 1 to discover the total number of pages
    const resp1 = await fetch(buildUrl(1), { headers: { Accept: 'application/json' } });
    if(!resp1.ok){
        const body = await resp1.text();
        console.error(`[GO] QuickGO request failed for ${goId}`, { page: 1, status: resp1.status, body });
        throw new Error(`HTTP ${resp1.status}`);
    }
    const data1 = await resp1.json();
    (data1.results || []).forEach(r => { if(r.symbol) symbols.add(r.symbol.toLowerCase()); });

    const hits = Number(data1.numberOfHits || (data1.results || []).length || 0);
    const totalPages = Math.max(1, Math.ceil(hits / limit));
    console.info(`[GO] ${goId}: ${hits} total annotations across ${totalPages} pages`);
    if(onProgress) onProgress({done: 1, total: totalPages, symbols: symbols.size, cached: false});

    if(totalPages > 1){
        // Fetch all remaining pages simultaneously — browser caps concurrent connections naturally
        const remainingPages = Array.from({length: totalPages - 1}, (_, i) => i + 2);
        const pageResults = await Promise.all(remainingPages.map(async (p) => {
            const resp = await fetch(buildUrl(p), { headers: { Accept: 'application/json' } });
            if(!resp.ok){
                console.warn(`[GO] Page ${p} for ${goId} returned HTTP ${resp.status}, skipping`);
                return [];
            }
            const d = await resp.json();
            return (d.results || []).filter(r => r.symbol).map(r => r.symbol.toLowerCase());
        }));
        pageResults.forEach(syms => syms.forEach(s => symbols.add(s)));
        if(onProgress) onProgress({done: totalPages, total: totalPages, symbols: symbols.size, cached: false});
    }

    const genes = Array.from(symbols);
    GO_TERM_GENES_CACHE[goId] = genes;
    console.info(`[GO] Completed ${goId}: ${genes.length} unique symbols loaded`);
    return genes;
}

function setGoButtonLoading(buttonId, isLoading, originalText){
    const btn = document.getElementById(buttonId);
    if(!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? '⏳ Fetching annotations…' : originalText;
}

function updateGoProgress(statusId, wrapId, barId, {done, total, symbols, cached}){
    const statusEl = document.getElementById(statusId);
    const wrap = document.getElementById(wrapId);
    const bar = document.getElementById(barId);
    if(!statusEl) return;

    if(cached){
        statusEl.textContent = `Using cached annotations (${symbols} genes). Plotting…`;
        if(wrap) wrap.style.display = 'none';
        return;
    }
    if(total <= 1){
        statusEl.textContent = `Fetched gene annotations (${symbols} unique genes). Plotting…`;
        if(wrap) wrap.style.display = 'none';
        return;
    }
    const pct = Math.round((done / total) * 100);
    statusEl.textContent = `Fetching annotations: ${done}/${total} pages (${symbols} unique genes found so far)…`;
    if(wrap){ wrap.style.display = 'block'; }
    if(bar){ bar.style.width = pct + '%'; }
    if(done >= total){
        statusEl.textContent = `Loaded ${symbols} gene annotations across ${total} pages. Plotting…`;
        setTimeout(() => { if(wrap) wrap.style.display = 'none'; }, 2500);
    }
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
    setGoButtonLoading('goSpatialGenerateBtn', true, 'Generate GO heatmap (Spatial)');

    try {
        const genes = await fetchGoTermGenes(goId, (progress) => {
            updateGoProgress('goSearchStatus', 'goSpatialProgressWrap', 'goSpatialProgressBar', progress);
        });
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
    } finally {
        setGoButtonLoading('goSpatialGenerateBtn', false, 'Generate GO heatmap (Spatial)');
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
    setGoButtonLoading('goTemporalGenerateBtn', true, 'Generate GO heatmap (Spatiotemporal)');
    console.groupCollapsed(`[GO Temporal] ${goId}`);
    console.info('[GO Temporal] Fetching GO annotations...');

    try {
        const genes = await fetchGoTermGenes(goId, (progress) => {
            updateGoProgress('goSearchStatusTemporal', 'goTemporalProgressWrap', 'goTemporalProgressBar', progress);
        });
        console.info('[GO Temporal] GO symbols fetched:', { goId, symbolsFetched: genes.length });
        const { matched, missing } = inspectGoGenesForDataset(goId, genes);
        console.info('[GO Temporal] Dataset match summary:', { matched: matched.length, missing });
        const geneCountEl = document.getElementById('goGeneCountTemporal');
        geneCountEl.textContent = `Found ${genes.length} GO symbols; ${matched.length} are present in this dataset (${missing} absent).`;
        if(matched.length === 0){
            statusEl.textContent = `Loaded GO genes for ${goId}, but none are present in the current dataset.`;
            console.warn('[GO Temporal] No matched genes in dataset.');
            console.groupEnd();
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
        renderTemporalHeatmapFromGenes(matched, region, goOptions);
        statusEl.textContent = `Plotted ${matched.length} dataset-matched genes for GO term ${goId}.`;
        console.info('[GO Temporal] Passed matched genes to plotTemporalHeatmap.', { region, metrics: goOptions.selectedMetrics });
    } catch (err){
        statusEl.textContent = `Failed to load genes for ${goId}: ${err.message}`;
        console.error('[GO Temporal] Failed:', err);
    } finally {
        setGoButtonLoading('goTemporalGenerateBtn', false, 'Generate GO heatmap (Spatiotemporal)');
        console.groupEnd();
    }
}

function renderTemporalHeatmapFromGenes(inputGenes, region, optionsOverride = null){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    clearTemporalStatsPanel();

    const genes = Array.isArray(inputGenes)
        ? Array.from(new Set(inputGenes.map(g => String(g).trim().toLowerCase()).filter(g => g)))
        : [];
    if(genes.length === 0){
        alert("Enter genes");
        return;
    }

    const aggregationMode = optionsOverride?.aggregationMode || getAggregationMode("temporalAggregation");
    const membershipMode = optionsOverride?.membershipMode || getHeatmapGeneMembership("temporalGeneMembership");
    const selectedMetrics = optionsOverride?.selectedMetrics || getSelectedTemporalMetrics();
    const pValueFilterMode = optionsOverride?.pValueFilterMode || (document.getElementById("temporalPValueFilter")?.value || "all");
    const applyPValueFilter = selectedMetrics.includes("P_VALUE") && pValueFilterMode === "significant";
    const times = [30, 60, 90, 120];

    console.groupCollapsed(`[TemporalHeatmap] Start | region=${region}`);
    console.info('[TemporalHeatmap] Input genes:', {
        rawGeneTextLength: genes.join(',').length,
        parsedGenes: genes.length,
        aggregationMode,
        membershipMode,
        selectedMetrics,
        pValueFilterMode,
        applyPValueFilter
    });

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

    console.info('[TemporalHeatmap] Dataset match summary:', {
        requestedGenes: genes.length,
        matchedGenes: entries.length,
        rnaRows: entries.reduce((sum, e) => sum + e.rnaGene.length, 0),
        protRows: entries.reduce((sum, e) => sum + e.protGene.length, 0)
    });

    entries.sort((a, b) => a.lagSort - b.lagSort);

    if(entries.length === 0){
        if(applyPValueFilter){
            alert("No genes passed the P_VALUE < 0.05 filter in selected region");
            console.warn('[TemporalHeatmap] No genes left after P_VALUE filter.');
            console.groupEnd();
            return;
        }
        alert(membershipMode === "both"
            ? "No genes found in both RNA and Protein for current selection"
            : "No valid genes found in selected region");
        console.warn('[TemporalHeatmap] No valid genes after membership/data checks.');
        console.groupEnd();
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

    console.info('[TemporalHeatmap] X-axis setup:', {
        aggregationMode,
        xLabelCount: xLabels.length,
        firstLabels: xDisplayLabels.slice(0, 8)
    });

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

    console.info('[TemporalHeatmap] Subplots:', {
        subplotCount: subplots.length,
        rnaHasData,
        protHasData,
        subplotTitles: subplots.map(s => s.title)
    });

    const heatmapHeight = Math.max(320, 120 + (geneLabels.length * 14));
    const yTickFontSize = geneLabels.length > 250 ? 8 : (geneLabels.length > 120 ? 9 : 10);
    const weights = subplots.map(slot => {
        if(slot.kind === "expr") return 2;
        if(slot.metric === "P_VALUE" || slot.metric === "Q_VALUE") return 0.7;
        return 1;
    });
    const subplotCount = Math.max(1, subplots.length);

    const customPlotTitle = optionsOverride?.plotTitle;

    const layout = {
        title: customPlotTitle || `Spatiotemporal Expression Heatmap - ${region}`,
        height: heatmapHeight,
        width: Math.max(900, 220 + (weights.reduce((sum, w) => sum + (w * 170), 0))),
        margin: {l: 230, r: subplots.length > 6 ? 220 : 140, t: 95, b: 145},
        grid: {rows: 1, columns: subplotCount, pattern: 'independent', xgap: 0.03},
        annotations: []
    };

    console.info('[TemporalHeatmap] Grid summary:', {
        rows: 1,
        columns: subplotCount,
        xgap: 0.03
    });

    const buildDomainColorbar = (index, totalBars, titleText) => {
        const columnCount = totalBars > 6 ? 2 : 1;
        const rowsPerColumn = Math.ceil(totalBars / columnCount);
        const columnIndex = Math.floor(index / rowsPerColumn);
        const rowIndex = index % rowsPerColumn;
        const verticalStep = 0.92 / Math.max(1, rowsPerColumn);
        const len = Math.min(0.22, Math.max(0.11, verticalStep * 0.72));
        const y = 0.97 - (rowIndex * verticalStep);

        return {
            title: {text: titleText, side: 'right', font: {size: 10}},
            orientation: 'v',
            x: 1.02 + (columnIndex * 0.09),
            xanchor: 'left',
            y,
            yanchor: 'top',
            len,
            thickness: 8
        };
    };

    const traces = [];
    let expressionColorbarShown = false;
    const shownMetricColorbars = new Set();
    subplots.forEach((slot, i) => {
        const axisIndex = i + 1;
        const xKey = axisIndex === 1 ? "x" : `x${axisIndex}`;
        const yKey = axisIndex === 1 ? "y" : `y${axisIndex}`;
        const layoutXKey = axisIndex === 1 ? "xaxis" : `xaxis${axisIndex}`;
        const layoutYKey = axisIndex === 1 ? "yaxis" : `yaxis${axisIndex}`;
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
            ticklen: 0
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
            ticklabeloverflow: 'allow'
        };

        if(isExpression){
            const showColorbar = !expressionColorbarShown;
            expressionColorbarShown = true;
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
                showscale: showColorbar,
                colorbar: showColorbar ? buildDomainColorbar(i, subplots.length, 'Z-score') : undefined
            });
        } else {
            const metricValues = buildMetricColumn(slot.dataset, slot.metric);
            const metricZValues = getMetricZValues(slot.metric, metricValues);
            const scaleConfig = getMetricScaleConfig(slot.metric);
            const metricText = metricValues.map(v => formatMetricCell(v));
            const showColorbar = !shownMetricColorbars.has(slot.metric);
            shownMetricColorbars.add(slot.metric);
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
                showscale: showColorbar,
                colorbar: showColorbar ? buildDomainColorbar(i, subplots.length, scaleConfig.colorbarTitle) : undefined
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

    try {
        Plotly.newPlot("plot", traces, layout);
    } catch (err) {
        console.error("Temporal heatmap rendering failed", err, {
            region,
            genesRequested: genes.length,
            genesMatched: entries.length,
            aggregationMode,
            membershipMode,
            selectedMetrics,
            xLabelCount: xDisplayLabels.length,
            subplotCount: subplots.length,
            grid: layout.grid,
            traceCount: traces.length
        });
        console.groupEnd();
        alert(`Failed to render spatiotemporal heatmap: ${err.message}`);
        return;
    }
    console.info('[TemporalHeatmap] Plot rendered successfully.', { traceCount: traces.length, genes: entries.length });
    console.groupEnd();
    saveCurrentViewPlot();
}

function plotTemporalHeatmap(overrideGenes, regionOverride, optionsOverride = null){
    const genes = Array.isArray(overrideGenes)
        ? overrideGenes
        : document.getElementById("temporalGenes").value.trim().split(',');
    const region = regionOverride || document.getElementById("heatmapRegion").value;
    return renderTemporalHeatmapFromGenes(genes, region, optionsOverride);
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
