const VIEW_PLOT_STATE = {};
let CURRENT_PLOT_METADATA = {
    modality: "plot",
    view: "general",
    source: "manual",
    region: "",
    goId: "",
    goName: ""
};

function cleanFilenamePart(value){
    return String(value || "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[\\/:*?"<>|#%&{}$!'@+=`~^.,;()\[\]]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
}

function setCurrentPlotMetadata(metadata = {}){
    const nextMetadata = {
        ...CURRENT_PLOT_METADATA,
        ...metadata
    };

    if(!Object.prototype.hasOwnProperty.call(metadata, 'headerStrip') || !metadata.headerStrip){
        delete nextMetadata.headerStrip;
    }
    if(!Object.prototype.hasOwnProperty.call(metadata, 'plotViewportMode') || !metadata.plotViewportMode){
        delete nextMetadata.plotViewportMode;
    }

    CURRENT_PLOT_METADATA = nextMetadata;
}

function applyPlotViewportMode(metadata = CURRENT_PLOT_METADATA){
    const plotLayout = document.getElementById('plotLayout');
    if(!plotLayout) return;

    plotLayout.classList.remove('plot-layout--spatial-single');

    if(metadata?.plotViewportMode === 'spatial-single'){
        plotLayout.classList.add('plot-layout--spatial-single');
    }
}

function buildPlotDownloadFilename(){
    const parts = ["proteomeui"];
    const modality = cleanFilenamePart(CURRENT_PLOT_METADATA.modality || "plot");
    const view = cleanFilenamePart(CURRENT_PLOT_METADATA.view || "general");
    const source = cleanFilenamePart(CURRENT_PLOT_METADATA.source || "manual");
    const region = cleanFilenamePart(CURRENT_PLOT_METADATA.region || "");
    const goId = cleanFilenamePart(CURRENT_PLOT_METADATA.goId || "");
    const goName = cleanFilenamePart(CURRENT_PLOT_METADATA.goName || "");

    if(modality) parts.push(modality);
    if(view) parts.push(view);
    if(source && source !== "manual") parts.push(source);
    if(region) parts.push(region);
    if(goId) parts.push(goId);
    if(goName) parts.push(goName);

    return parts.join("_");
}

function buildResponsiveLayout(layout, options = {}){
    const next = {...layout};
    const {heightMode = "adaptive"} = options;
    delete next.width;
    next.autosize = true;

    if(heightMode === "single-gene"){
        const viewportHeight = window.innerHeight || 900;
        const minHeight = Math.max(380, Math.round(viewportHeight * 0.45));
        const maxHeight = Math.round(viewportHeight * 0.86);
        const requestedHeight = Number.isFinite(next.height)
            ? next.height
            : Math.round(viewportHeight * 0.72);
        next.height = Math.max(minHeight, Math.min(maxHeight, requestedHeight));
        return next;
    }

    // Keep heatmap sizing as provided by caller; only fill in when absent.
    if(!Number.isFinite(next.height)){
        const viewportHeight = window.innerHeight || 900;
        next.height = Math.round(viewportHeight * 0.72);
    }

    return next;
}

function plotWithResponsiveSizing(targetId, data, layout, config = {}){
    const {heightMode = "adaptive", ...plotlyConfigInput} = config;
    const responsiveLayout = buildResponsiveLayout(layout, {heightMode});
    const filename = buildPlotDownloadFilename();
    const responsiveConfig = {
        responsive: true,
        toImageButtonOptions: {
            filename,
            format: "png",
            scale: 2
        },
        ...plotlyConfigInput
    };
    responsiveConfig.toImageButtonOptions = {
        filename,
        format: "png",
        scale: 2,
        ...(plotlyConfigInput.toImageButtonOptions || {})
    };
    return Plotly.newPlot(targetId, data, responsiveLayout, responsiveConfig).then(result => {
        renderPlotHeaderStrip(CURRENT_PLOT_METADATA);
        applyPlotViewportMode(CURRENT_PLOT_METADATA);
        return result;
    });
}

function clonePlotState(value){
    return JSON.parse(JSON.stringify(value));
}

function parseGeneInput(input){
    const raw = Array.isArray(input) ? input.join("\n") : String(input || "");
    const normalized = raw
        .replace(/\\[tnr]/g, " ")
        .replace(/\r\n?|\n/g, "\n");

    const tokens = normalized
        .split(/[\s,;]+/)
        .map(token => token.trim())
        .map(token => token.replace(/^["']+|["']+$/g, ""))
        .filter(token => token.length > 0)
        .map(token => token.toLowerCase());

    return Array.from(new Set(tokens));
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
    clearPlotHeaderStrip();
    applyPlotViewportMode({});
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
        metadata: clonePlotState(CURRENT_PLOT_METADATA || {}),
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
    if(state.metadata){
        setCurrentPlotMetadata(state.metadata);
    }
    plotWithResponsiveSizing("plot", clonePlotState(state.data), clonePlotState(state.layout), clonePlotState(state.config));

    const statsPanel = document.getElementById("temporalStatsPanel");
    if(statsPanel){
        statsPanel.innerHTML = state.statsHtml || "";
        statsPanel.classList.toggle("active", !!state.statsActive);
    }
}

function getSpatialCorrelationEntry(gene){
    if(!gene || typeof RHO_CORRELATION_DATA === "undefined" || !(RHO_CORRELATION_DATA instanceof Map)) return null;
    return RHO_CORRELATION_DATA.get(String(gene).trim().toLowerCase()) || null;
}

function getSpatialCorrelationValue(gene){
    const entry = getSpatialCorrelationEntry(gene);
    return entry && Number.isFinite(entry.value) ? entry.value : NaN;
}

function formatSpatialCorrelation(value){
    return Number.isFinite(value) ? value.toFixed(4) : "unavailable";
}

function getSpatialCorrelationBand(value){
    if(!Number.isFinite(value)) return "unavailable";
    if(value > 0.5) return "highly correlated";
    if(value < -0.5) return "anti-correlated";
    return "lowly correlated";
}

function buildSpatialCorrelationGuideAnnotation({ x = 1.02, y = 1.0, xanchor = 'left' } = {}){
    return {
        x,
        y,
        xref: 'paper',
        yref: 'paper',
        xanchor,
        yanchor: 'top',
        align: 'left',
        showarrow: false,
        bgcolor: 'rgba(255,255,255,0.92)',
        bordercolor: '#c7c2b8',
        borderwidth: 1,
        borderpad: 8,
        font: {size: 11, color: '#40362e'},
        text: '<b>Rho guide</b><br>rho &gt; 0.5: highly correlated<br>-0.5 ≤ rho ≤ 0.5: lowly correlated<br>rho &lt; -0.5: anti-correlated'
    };
}

const SPATIAL_RHO_COLORSCALE = [
    [0.0, '#020106'],
    [0.12, '#16081f'],
    [0.28, '#41106f'],
    [0.5, '#8f2f8f'],
    [0.72, '#f26d5b'],
    [0.88, '#fdbb84'],
    [1.0, '#ffffbf']
];

const TEMPORAL_TIMEPOINT_HEADER_COLORS = ['#ffc963', '#ffa45e', '#ff775c', '#ff5789'];
const TEMPORAL_REGION_COLORS_RNA = {
    'p-PSM': '#D4AF37',
    'a-PSM': '#F9D777',
    'Somite': '#F9E8B8',
    Posterior: '#D4AF37',
    Anterior: '#F9D777'
};
const TEMPORAL_REGION_COLORS_PROTEIN = {
    'p-PSM': '#8281BE',
    'a-PSM': '#B2B2D9',
    'Somite': '#D7D6EC',
    Posterior: '#8281BE',
    Anterior: '#B2B2D9'
};

function normalizeTemporalRegionKey(region){
    const key = String(region || '').trim().toLowerCase();
    if(key === 'p-psm' || key === 'posterior') return 'p-PSM';
    if(key === 'a-psm' || key === 'anterior') return 'a-PSM';
    if(key === 'somite') return 'Somite';
    return String(region || '').trim();
}

function getTemporalRegionHeaderColor(dataset, region){
    const normalized = normalizeTemporalRegionKey(region);
    if(dataset === 'RNA'){
        return TEMPORAL_REGION_COLORS_RNA[normalized] || TEMPORAL_REGION_COLORS_RNA.Somite;
    }
    return TEMPORAL_REGION_COLORS_PROTEIN[normalized] || TEMPORAL_REGION_COLORS_PROTEIN.Somite;
}

function getPlotHeaderStripElement(){
    return document.getElementById('plotHeaderStrip');
}

function clearPlotHeaderStrip(){
    const strip = getPlotHeaderStripElement();
    if(!strip) return;

    strip.innerHTML = '';
    strip.className = 'plot-header-strip';
    strip.hidden = true;
    strip.removeAttribute('data-modality');
    strip.removeAttribute('data-view');
    strip.removeAttribute('data-source');
    strip.removeAttribute('data-region');
    strip.removeAttribute('data-mode');
    strip.removeAttribute('data-title');
}

function renderPlotHeaderStrip(metadata = CURRENT_PLOT_METADATA){
    const strip = getPlotHeaderStripElement();
    if(!strip){
        return;
    }

    const headerStrip = metadata?.headerStrip;
    const shouldShow = headerStrip
        && headerStrip.kind === 'temporal-expression'
        && headerStrip.aggregationMode !== 'samples'
        && Array.isArray(headerStrip.columns)
        && headerStrip.columns.some(column => column.kind === 'expr');

    if(!shouldShow){
        clearPlotHeaderStrip();
        return;
    }

    const columns = headerStrip.columns;
    const timepoints = Array.isArray(headerStrip.timepoints) ? headerStrip.timepoints : [];
    const regionLabel = normalizeTemporalRegionKey(metadata?.region || headerStrip.region || '');
    const leftMargin = Number(headerStrip.leftMargin) || 0;
    const rightMargin = Number(headerStrip.rightMargin) || 0;
    const headerTitle = String(headerStrip.title || '').trim();

    strip.hidden = false;
    strip.className = 'plot-header-strip plot-header-strip--temporal is-visible';
    strip.dataset.modality = metadata?.modality || '';
    strip.dataset.view = metadata?.view || '';
    strip.dataset.source = metadata?.source || '';
    strip.dataset.region = regionLabel;
    strip.dataset.mode = headerStrip.aggregationMode || '';
    strip.dataset.title = headerTitle;
    strip.style.paddingLeft = `${leftMargin}px`;
    strip.style.paddingRight = `${rightMargin}px`;
    strip.style.gridTemplateColumns = columns.map(column => `${column.weight || 1}fr`).join(' ');

    strip.replaceChildren();

    if(headerTitle){
        const title = document.createElement('div');
        title.className = 'plot-header-strip__title';
        title.textContent = headerTitle;
        title.style.gridColumn = '1 / -1';
        strip.appendChild(title);
    }

    columns.forEach(column => {
        const cell = document.createElement('div');
        cell.className = 'plot-header-strip__cell';

        if(column.kind !== 'expr'){
            cell.classList.add('plot-header-strip__cell--blank');
            strip.appendChild(cell);
            return;
        }

        const modalityLabel = document.createElement('div');
        modalityLabel.className = 'plot-header-strip__modality-label';
        modalityLabel.textContent = column.dataset || column.label || '';
        cell.appendChild(modalityLabel);

        const regionBar = document.createElement('div');
        regionBar.className = 'plot-header-strip__region-bar';
        regionBar.style.backgroundColor = getTemporalRegionHeaderColor(column.dataset || column.label, metadata?.region || headerStrip.region);
        regionBar.textContent = regionLabel;
        cell.appendChild(regionBar);

        const timepointRow = document.createElement('div');
        timepointRow.className = 'plot-header-strip__timepoint-row';
        timepointRow.style.gridTemplateColumns = `repeat(${Math.max(1, timepoints.length)}, minmax(0, 1fr))`;

        timepoints.forEach((timepoint, index) => {
            const timepointCell = document.createElement('div');
            timepointCell.className = 'plot-header-strip__timepoint';
            timepointCell.style.backgroundColor = TEMPORAL_TIMEPOINT_HEADER_COLORS[index % TEMPORAL_TIMEPOINT_HEADER_COLORS.length];
            timepointCell.textContent = String(timepoint);
            timepointRow.appendChild(timepointCell);
        });

        cell.appendChild(timepointRow);
        strip.appendChild(cell);
    });
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
    setCurrentPlotMetadata({
        modality: "spatial",
        view: "single-gene",
        source: "manual",
        plotViewportMode: "spatial-single",
        region: "all-regions",
        goId: "",
        goName: ""
    });
    const rhoValue = getSpatialCorrelationValue(displayGene);
    const rhoBand = getSpatialCorrelationBand(rhoValue);
    const spatialDatasetSuffix = rnaGene.length > 0 && protGene.length > 0 ? " — RNA & Protein"
        : rnaGene.length > 0 ? " — RNA"
        : " — Protein";
    const layout = {
        title: `Spatial Expression - ${displayGene}${spatialDatasetSuffix}<br><sup>RNA-protein rho correlation: ${formatSpatialCorrelation(rhoValue)} (${rhoBand})</sup>`,
        showlegend: true,
        template: "simple_white",
        height: 600,
        margin: {l: 80, r: 220, t: 90, b: 80},
        annotations: [buildSpatialCorrelationGuideAnnotation()]
    };

    const order = ['Posterior', 'Anterior', 'Somite'];

    if(rnaGene.length > 0){
        rnaGene.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
        traces.push({
            x: rnaGene.map(d => d.group),
            y: rnaGene.map(d => d.spatialValue),
            type: "box",
            name: "RNA",
            marker: {color: "#d5af34"}
        });
    }

    if(protGene.length > 0){
        protGene.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
        traces.push({
            x: protGene.map(d => d.group),
            y: protGene.map(d => d.spatialValue),
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

    plotWithResponsiveSizing("plot", traces, layout, {heightMode: "single-gene"});
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
    setCurrentPlotMetadata({
        modality: "spatiotemporal",
        view: "single-gene",
        source: "manual",
        region: "all-regions",
        goId: "",
        goName: ""
    });

    clearTemporalStatsPanel();

    const regions = ["p-psm", "a-psm", "Somite"];
    const regionPanels = regions.map(region => {
        const regionLower = region.toLowerCase();
        const rnaGene = RNA_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === regionLower && d.time >= 0);
        const protGene = PROT_DATA.filter(d => d.ID && String(d.ID).toLowerCase() === gene && d.region && d.region.toLowerCase() === regionLower && d.time >= 0);
        return {region, rnaGene, protGene};
    });

    const regionPanelsWithData = regionPanels.filter(panel => panel.rnaGene.length > 0 || panel.protGene.length > 0);

    if(regionPanelsWithData.length === 0){
        alert("Gene not found in any region");
        return;
    }

    const traces = [];
    const times = [30, 60, 90, 120];
    const timeLabels = times.map(String);
    const showSineFit = !!document.getElementById("temporalShowSineFit")?.checked;

    const firstPanel = regionPanelsWithData[0] || {};
    const displayGene = (firstPanel.rnaGene?.[0]?.ID || firstPanel.protGene?.[0]?.ID || gene).toUpperCase();

    const columns = regionPanels.length;
    const rows = 2;

    const getAxisRef = (rowIndex, columnIndex) => {
        const axisIndex = (rowIndex * columns) + columnIndex + 1;
        return {
            x: axisIndex === 1 ? 'x' : `x${axisIndex}`,
            y: axisIndex === 1 ? 'y' : `y${axisIndex}`,
            suffix: axisIndex === 1 ? '' : String(axisIndex)
        };
    };

    regionPanels.forEach((panel, panelIndex) => {
        const rnaAxis = getAxisRef(0, panelIndex);
        const protAxis = getAxisRef(1, panelIndex);
        const regionLabel = panel.region;
        const rnaLegendGroup = `${regionLabel}-RNA`;
        const protLegendGroup = `${regionLabel}-Protein`;
        const rnaRegionColor = getTemporalRegionHeaderColor('RNA', regionLabel);
        const protRegionColor = getTemporalRegionHeaderColor('Protein', regionLabel);

        if(panel.rnaGene.length > 0){
            let rnaLegendShown = false;
            times.forEach(time => {
                const yVals = panel.rnaGene.filter(d => d.time === time).map(d => d.value);
                if(yVals.length > 0){
                    traces.push({
                        x: Array(yVals.length).fill(time),
                        y: yVals,
                        type: "box",
                        name: `${regionLabel} RNA`,
                        legendgroup: rnaLegendGroup,
                        showlegend: !rnaLegendShown,
                        marker: {color: rnaRegionColor},
                        line: {color: rnaRegionColor},
                        boxmean: true,
                        boxpoints: false,
                        xaxis: rnaAxis.x,
                        yaxis: rnaAxis.y
                    });
                    rnaLegendShown = true;
                }
            });

            traces.push({
                x: panel.rnaGene.map(d => Number(d.time)),
                y: panel.rnaGene.map(d => d.value),
                mode: "markers",
                type: "scatter",
                name: `${regionLabel} RNA points`,
                legendgroup: rnaLegendGroup,
                showlegend: false,
                marker: {color: rnaRegionColor, size: 6, opacity: 0.8},
                xaxis: rnaAxis.x,
                yaxis: rnaAxis.y
            });

            if(showSineFit){
                const rnaFit = buildBiocycleFitTrace(panel.rnaGene, "RNA", rnaRegionColor);
                if(rnaFit){
                    traces.push({
                        ...rnaFit,
                        name: `${regionLabel} ${rnaFit.name}`,
                        legendgroup: rnaLegendGroup,
                        xaxis: rnaAxis.x,
                        yaxis: rnaAxis.y,
                        showlegend: true
                    });
                }
            }
        }

        if(panel.protGene.length > 0){
            let protLegendShown = false;
            times.forEach(time => {
                const yVals = panel.protGene.filter(d => d.time === time).map(d => d.value);
                if(yVals.length > 0){
                    traces.push({
                        x: Array(yVals.length).fill(time),
                        y: yVals,
                        type: "box",
                        name: `${regionLabel} Protein`,
                        legendgroup: protLegendGroup,
                        showlegend: !protLegendShown,
                        marker: {color: protRegionColor},
                        line: {color: protRegionColor},
                        boxmean: true,
                        boxpoints: false,
                        xaxis: protAxis.x,
                        yaxis: protAxis.y
                    });
                    protLegendShown = true;
                }
            });

            traces.push({
                x: panel.protGene.map(d => Number(d.time)),
                y: panel.protGene.map(d => d.value),
                mode: "markers",
                type: "scatter",
                name: `${regionLabel} Protein points`,
                legendgroup: protLegendGroup,
                showlegend: false,
                marker: {color: protRegionColor, size: 6, opacity: 0.8},
                xaxis: protAxis.x,
                yaxis: protAxis.y
            });

            if(showSineFit){
                const protFit = buildBiocycleFitTrace(panel.protGene, "Protein", protRegionColor);
                if(protFit){
                    traces.push({
                        ...protFit,
                        name: `${regionLabel} ${protFit.name}`,
                        legendgroup: protLegendGroup,
                        xaxis: protAxis.x,
                        yaxis: protAxis.y,
                        showlegend: true
                    });
                }
            }
        }
    });

    const layout = {
        title: `Spatiotemporal Expression - ${displayGene} (all regions)`,
        template: "simple_white",
        height: 700,
        grid: {rows, columns, pattern: 'independent'},
        showlegend: true,
        legend: { orientation: 'h', y: 1.1 },
        annotations: []
    };

    regionPanels.forEach((panel, panelIndex) => {
        const rnaAxis = getAxisRef(0, panelIndex);
        const protAxis = getAxisRef(1, panelIndex);

        layout[`xaxis${rnaAxis.suffix}`] = {
            title: 'Time (minutes)',
            type: 'linear',
            tickmode: 'array',
            tickvals: times,
            ticktext: timeLabels,
            range: [0, 150]
        };

        layout[`xaxis${protAxis.suffix}`] = {
            title: 'Time (minutes)',
            type: 'linear',
            tickmode: 'array',
            tickvals: times,
            ticktext: timeLabels,
            range: [0, 150]
        };

        layout[`yaxis${rnaAxis.suffix}`] = {
            title: panelIndex === 0 ? 'RNA (Log2 Normalized Counts)' : '',
            automargin: true
        };

        layout[`yaxis${protAxis.suffix}`] = {
            title: panelIndex === 0 ? 'Protein (LFQ)' : '',
            automargin: true
        };

        layout.annotations.push({
            text: panel.region,
            x: 0.5,
            y: 1.05,
            xref: panelIndex === 0 ? 'x domain' : `x${panelIndex + 1} domain`,
            yref: panelIndex === 0 ? 'y domain' : `y${panelIndex + 1} domain`,
            showarrow: false,
            font: {size: 13}
        });
    });

    plotWithResponsiveSizing("plot", traces, layout, {heightMode: "single-gene"});
    saveCurrentViewPlot();
}

function plotSpatialHeatmap(overrideGenes, optionsOverride = null){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        return;
    }

    clearTemporalStatsPanel();

    const genesInput = Array.isArray(overrideGenes)
        ? overrideGenes
        : document.getElementById("spatialGenes").value;
    const genes = parseGeneInput(genesInput);

    if(genes.length === 0){
        alert("Enter genes");
        return;
    }

    const groups = ['Posterior', 'Anterior', 'Somite'];
    const membershipMode = optionsOverride?.membershipMode || getHeatmapGeneMembership("spatialGeneMembership");
    const aggregationMode = optionsOverride?.aggregationMode || getAggregationMode("spatialAggregation");
    const plotContext = optionsOverride?.plotContext || {};
    setCurrentPlotMetadata({
        modality: "spatial",
        view: "heatmap",
        source: plotContext.source || "manual",
        region: plotContext.region || "all-regions",
        goId: plotContext.goId || "",
        goName: plotContext.goName || ""
    });

    const toZScore = (row) => Number.isFinite(row.spatialValue) ? row.spatialValue : NaN;
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
            posteriorSort,
            rhoValue: getSpatialCorrelationValue(rnaGene[0]?.ID || protGene[0]?.ID || gene)
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
    const matrixRho = entries.map(e => [e.rhoValue]);
    const rhoText = entries.map(e => [Number.isFinite(e.rhoValue) ? e.rhoValue.toFixed(2) : ""]);

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

    const panels = [];
    if(matrixRNA.some(row => row.some(v => !isNaN(v)))){
        panels.push({
            title: "RNA",
            z: matrixRNA,
            x: xLabels,
            y: geneLabels,
            type: "heatmap",
            panelKind: 'expr'
        });
    }
    if(matrixProt.some(row => row.some(v => !isNaN(v)))){
        panels.push({
            title: "Protein",
            z: matrixProt,
            x: xLabels,
            y: geneLabels,
            type: "heatmap",
            panelKind: 'expr'
        });
    }
    if(matrixRho.some(row => row.some(v => !isNaN(v)))){
        panels.push({
            title: "Rho correlation",
            z: matrixRho,
            x: ['Rho'],
            y: geneLabels,
            type: "heatmap",
            panelKind: 'rho',
            text: rhoText,
            texttemplate: '%{text}',
            textfont: {size: Math.max(8, Math.min(12, yTickFontSize + 1))},
            hovertemplate: 'Gene: %{y}<br>Rho: %{z:.4f}<extra></extra>'
        });
    }

    const customPlotTitle = optionsOverride?.plotTitle;
    const hasRhoPanel = panels.some(panel => panel.panelKind === 'rho');
    const panelDomains = (() => {
        if(panels.length === 0) return [];

        if(!hasRhoPanel){
            const gap = panels.length > 1 ? 0.04 : 0;
            const width = (1 - (gap * (panels.length - 1))) / panels.length;
            return panels.map((_, index) => {
                const start = index * (width + gap);
                return [start, start + width];
            });
        }

        const gap = panels.length > 1 ? 0.035 : 0;
        const rhoWidth = 0.10;
        const nonRhoCount = panels.filter(panel => panel.panelKind !== 'rho').length;
        const remainingWidth = 1 - rhoWidth - (gap * (panels.length - 1));
        const mainWidth = nonRhoCount > 0 ? remainingWidth / nonRhoCount : remainingWidth;

        let currentStart = 0;
        return panels.map(panel => {
            const width = panel.panelKind === 'rho' ? rhoWidth : mainWidth;
            const domain = [currentStart, currentStart + width];
            currentStart += width + gap;
            return domain;
        });
    })();

    const buildPanelColorbar = (domain, titleText, isRhoPanel = false) => {
        const start = domain[0];
        const end = domain[1];
        const width = Math.max(0.08, end - start);
        return {
            title: {text: titleText, side: 'top', font: {size: 11}},
            orientation: 'h',
            x: (start + end) / 2,
            xanchor: 'center',
            y: -0.10,
            yanchor: 'top',
            len: Math.max(0.08, width * 0.9),
            thickness: 10,
            tickmode: isRhoPanel ? 'array' : undefined,
            tickvals: isRhoPanel ? [-1, -0.5, 0, 0.5, 1] : undefined,
            ticktext: isRhoPanel ? ['-1', '-0.5', '0', '0.5', '1'] : undefined
        };
    };

    const layout = {
        title: customPlotTitle || "Spatial Expression Heatmap",
        height: heatmapHeight,
        margin: {l: 220, r: 40, t: 90, b: hasRhoPanel ? 180 : 150},
        annotations: []
    };

    if(hasRhoPanel){
        layout.annotations.push(buildSpatialCorrelationGuideAnnotation({x: 0.86, y: -0.33, xanchor: 'center'}));
    }

    const data = panels.map((panel, index) => {
        const axisSuffix = index === 0 ? '' : String(index + 1);
        const xAxisName = `xaxis${axisSuffix}`;
        const yAxisName = `yaxis${axisSuffix}`;
        const tickAngle = panel.panelKind === 'rho' ? 0 : (aggregationMode === "samples" ? -45 : 0);

        layout[xAxisName] = {
            title: '',
            type: 'category',
            domain: panelDomains[index],
            tickangle: tickAngle,
            ticks: '',
            ticklen: 0
        };
        layout[yAxisName] = index === 0
            ? {...yAxisBase}
            : {...yAxisBase, title: '', showticklabels: false};

        layout.annotations.push({
            text: panel.title,
            x: 0.5,
            y: 1.06,
            xref: index === 0 ? 'x domain' : `x${index + 1} domain`,
            yref: index === 0 ? 'y domain' : `y${index + 1} domain`,
            showarrow: false,
            font: {size: 16}
        });

        const isRhoPanel = panel.panelKind === 'rho';
        return {
            z: panel.z,
            x: panel.x,
            y: panel.y,
            type: panel.type,
            text: panel.text,
            texttemplate: panel.texttemplate,
            textfont: panel.textfont,
            hovertemplate: panel.hovertemplate,
            xaxis: index === 0 ? 'x' : `x${index + 1}`,
            yaxis: index === 0 ? 'y' : `y${index + 1}`,
            colorscale: isRhoPanel ? SPATIAL_RHO_COLORSCALE : 'Viridis',
            zmin: isRhoPanel ? -1 : -2,
            zmax: isRhoPanel ? 1 : 2,
            zmid: isRhoPanel ? 0 : undefined,
            showscale: true,
            colorbar: buildPanelColorbar(panelDomains[index], isRhoPanel ? 'Rho' : 'Z-score', isRhoPanel)
        };
    });

    plotWithResponsiveSizing("plot", data, layout);
    saveCurrentViewPlot();
}

function getGenesFromRows(rows, predicate = null){
    const out = new Set();
    rows.forEach(row => {
        if(!row || !row.ID) return;
        if(predicate && !predicate(row)) return;
        out.add(String(row.ID).toLowerCase());
    });
    return out;
}

function intersectSets(a, b){
    const out = new Set();
    a.forEach(value => {
        if(b.has(value)) out.add(value);
    });
    return out;
}

function getDifferentialGeneSet(){
    if(typeof DIFFERENTIALLY_EXPRESSED_GENES !== "undefined" && DIFFERENTIALLY_EXPRESSED_GENES instanceof Set){
        return DIFFERENTIALLY_EXPRESSED_GENES;
    }
    return new Set();
}

function passesRhoBandFilter(rhoValue, rhoBand){
    if(rhoBand === "all") return true;
    if(!Number.isFinite(rhoValue)) return false;
    if(rhoBand === "neg") return rhoValue < -0.5;
    if(rhoBand === "mid") return rhoValue >= -0.5 && rhoValue <= 0.5;
    if(rhoBand === "pos") return rhoValue > 0.5;
    return true;
}

function passesDeFilter(geneLower, deStatus, differentialSet){
    if(deStatus === "all") return true;
    const isDe = differentialSet.has(geneLower);
    if(deStatus === "de") return isDe;
    if(deStatus === "nonde") return !isDe;
    return true;
}

function setExplorerStatus(statusId, message){
    const statusEl = document.getElementById(statusId);
    if(statusEl) statusEl.textContent = message;
}

function getExplorerRiskLabel(estimatedCells){
    if(estimatedCells < 30000) return "low";
    if(estimatedCells < 120000) return "medium";
    return "high";
}

function setExplorerFeedback(estimateId, adviceId, payload){
    const estimateEl = document.getElementById(estimateId);
    const adviceEl = document.getElementById(adviceId);
    if(estimateEl){
        estimateEl.textContent = payload.estimateText || "";
        estimateEl.className = `explorer-estimate risk-${payload.risk || "low"}`;
    }
    if(adviceEl){
        adviceEl.textContent = payload.adviceText || "";
    }
}

function buildExplorerAdvice({risk, aggregationMode, membershipMode, hasPValueFilter}){
    const suggestions = [];
    if(aggregationMode === "samples") suggestions.push("Switch to average mode to reduce columns.");
    if(membershipMode !== "both") suggestions.push("Use 'both datasets only' to reduce gene count.");
    if(!hasPValueFilter) suggestions.push("Apply a stricter p-value threshold (0.05) to reduce genes.");
    if(risk === "high") suggestions.push("Try plotting one region at a time or narrowing rho/de filters first.");

    if(suggestions.length === 0){
        if(risk === "low") return "Current selection is lightweight for most browsers.";
        if(risk === "medium") return "Selection should work, but plotting may take a few seconds.";
        return "Large selection. Plotting may be slow on less powerful machines.";
    }
    return `Suggested actions: ${suggestions.join(" ")}`;
}

function getTopNPreviewConfig(enabledId, nId){
    const enabled = !!document.getElementById(enabledId)?.checked;
    const nRaw = Number(document.getElementById(nId)?.value);
    const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.floor(nRaw) : 10;
    return {enabled, n};
}

function applyTopNPreview(genes, enabledId, nId){
    const preview = getTopNPreviewConfig(enabledId, nId);
    if(!preview.enabled) return {displayGenes: [...genes], previewEnabled: false, previewN: preview.n};
    return {
        displayGenes: genes.slice(0, preview.n),
        previewEnabled: true,
        previewN: preview.n
    };
}

function sortSpatialGenesByMode(genes, mode){
    const rows = genes.map(gene => ({
        gene,
        rho: getSpatialCorrelationValue(gene)
    }));

    const withNaNLast = (a, b, valueA, valueB, fallbackMode = "alpha") => {
        const aNan = Number.isNaN(valueA);
        const bNan = Number.isNaN(valueB);
        if(aNan && bNan) return String(a.gene).localeCompare(String(b.gene));
        if(aNan) return 1;
        if(bNan) return -1;
        if(valueA !== valueB) return valueA - valueB;
        if(fallbackMode === "alpha") return String(a.gene).localeCompare(String(b.gene));
        return 0;
    };

    rows.sort((a, b) => {
        if(mode === "rho_abs_asc") return withNaNLast(a, b, Math.abs(a.rho), Math.abs(b.rho));
        if(mode === "rho_abs_desc") return withNaNLast(a, b, -Math.abs(a.rho), -Math.abs(b.rho));
        if(mode === "rho_asc") return withNaNLast(a, b, a.rho, b.rho);
        if(mode === "rho_desc") return withNaNLast(a, b, -a.rho, -b.rho);
        return String(a.gene).localeCompare(String(b.gene));
    });

    return rows.map(row => row.gene);
}

function getTemporalMetricScore(rnaRows, protRows, metricName, mode = "metric_asc"){
    const values = [];
    rnaRows.forEach(row => {
        const v = Number(row[metricName]);
        if(!Number.isNaN(v)) values.push(v);
    });
    protRows.forEach(row => {
        const v = Number(row[metricName]);
        if(!Number.isNaN(v)) values.push(v);
    });

    if(values.length === 0) return Number.POSITIVE_INFINITY;
    if(mode === "metric_desc") return -Math.max(...values);
    return Math.min(...values);
}

function sortTemporalGenesByMode(genes, mode, geneRowsByGene, metricName){
    if(mode === "alpha") return [...genes].sort((a, b) => String(a).localeCompare(String(b)));

    const rows = genes.map(gene => {
        const pair = geneRowsByGene.get(gene) || {rnaRows: [], protRows: []};
        return {
            gene,
            score: getTemporalMetricScore(pair.rnaRows, pair.protRows, metricName, mode)
        };
    });

    rows.sort((a, b) => {
        if(a.score !== b.score) return a.score - b.score;
        return String(a.gene).localeCompare(String(b.gene));
    });

    return rows.map(row => row.gene);
}

function getSpatialExplorerSelection(){
    const rhoBand = document.getElementById("explorerSpatialRhoBand")?.value || "all";
    const deStatus = document.getElementById("explorerSpatialDeStatus")?.value || "all";
    const membershipMode = document.getElementById("explorerSpatialMembership")?.value || "all";
    const aggregationMode = document.getElementById("explorerSpatialAggregation")?.value || "average";
    const topNSortMode = document.getElementById("explorerSpatialTopNSort")?.value || "rho_abs_asc";

    const groups = ["Posterior", "Anterior", "Somite"];
    const byGene = new Map();
    const ensureGeneEntry = (geneLower) => {
        if(!byGene.has(geneLower)){
            byGene.set(geneLower, {
                hasRna: false,
                hasProt: false,
                rnaCountByGroup: {Posterior: 0, Anterior: 0, Somite: 0},
                protCountByGroup: {Posterior: 0, Anterior: 0, Somite: 0}
            });
        }
        return byGene.get(geneLower);
    };

    RNA_DATA.forEach(row => {
        if(!row || row.time || !row.ID) return;
        const geneLower = String(row.ID).toLowerCase();
        const entry = ensureGeneEntry(geneLower);
        entry.hasRna = true;
        const group = row.group;
        if(group && Object.prototype.hasOwnProperty.call(entry.rnaCountByGroup, group)){
            entry.rnaCountByGroup[group] += 1;
        }
    });

    PROT_DATA.forEach(row => {
        if(!row || row.time || !row.ID) return;
        const geneLower = String(row.ID).toLowerCase();
        const entry = ensureGeneEntry(geneLower);
        entry.hasProt = true;
        const group = row.group;
        if(group && Object.prototype.hasOwnProperty.call(entry.protCountByGroup, group)){
            entry.protCountByGroup[group] += 1;
        }
    });

    const baseGenes = Array.from(byGene.keys()).filter(geneLower => {
        const entry = byGene.get(geneLower);
        if(membershipMode === "both") return entry.hasRna && entry.hasProt;
        return entry.hasRna || entry.hasProt;
    });

    const differentialSet = getDifferentialGeneSet();
    const deListRequiredButMissing = (deStatus === "de" || deStatus === "nonde") && differentialSet.size === 0;

    const filteredGenes = deListRequiredButMissing
        ? []
        : baseGenes
            .filter(geneLower => {
                const rhoValue = getSpatialCorrelationValue(geneLower);
                return passesRhoBandFilter(rhoValue, rhoBand)
                    && passesDeFilter(geneLower, deStatus, differentialSet);
            });

    const rankedGenes = sortSpatialGenesByMode(filteredGenes, topNSortMode);

    const replicateEstimate = aggregationMode === "samples"
        ? groups.reduce((sum, group) => {
            let maxCount = 1;
            filteredGenes.forEach(geneLower => {
                const entry = byGene.get(geneLower);
                if(!entry) return;
                const rnaCount = entry.rnaCountByGroup[group] || 0;
                const protCount = entry.protCountByGroup[group] || 0;
                maxCount = Math.max(maxCount, rnaCount, protCount);
            });
            return sum + maxCount;
        }, 0)
        : groups.length;

    const estimatedColumns = (replicateEstimate * 2) + 1;
    const estimatedCells = filteredGenes.length * estimatedColumns;
    const risk = getExplorerRiskLabel(estimatedCells);

    return {
        rhoBand,
        deStatus,
        membershipMode,
        aggregationMode,
        filteredGenes,
        rankedGenes,
        topNSortMode,
        deListRequiredButMissing,
        estimatedColumns,
        estimatedCells,
        risk
    };
}

function updateSpatialExplorerPreview(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        setExplorerFeedback("explorerSpatialEstimate", "explorerSpatialAdvice", {
            estimateText: "Loading data...",
            adviceText: "Preview will update as soon as data is available.",
            risk: "low"
        });
        return;
    }

    const selection = getSpatialExplorerSelection();
    const preview = applyTopNPreview(selection.rankedGenes, "explorerSpatialTopNEnabled", "explorerSpatialTopN");
    const displayCells = preview.displayGenes.length * selection.estimatedColumns;
    const displayRisk = getExplorerRiskLabel(displayCells);
    if(selection.deListRequiredButMissing){
        setExplorerFeedback("explorerSpatialEstimate", "explorerSpatialAdvice", {
            estimateText: "DE list required but not loaded.",
            adviceText: "Switch DE filter to 'All genes' or verify heatmap_order_20260326.txt is available.",
            risk: "high"
        });
        return;
    }

    setExplorerFeedback("explorerSpatialEstimate", "explorerSpatialAdvice", {
        estimateText: preview.previewEnabled
            ? `Selection preview: ${selection.filteredGenes.length} matched genes. Plot will show top ${preview.displayGenes.length} genes (~${displayCells.toLocaleString()} cells, ${displayRisk} load), sorted by ${selection.topNSortMode}.`
            : `Selection preview: ${selection.filteredGenes.length} genes, ~${selection.estimatedColumns} columns, ~${selection.estimatedCells.toLocaleString()} heatmap cells (${selection.risk} load).`,
        adviceText: buildExplorerAdvice({
            risk: preview.previewEnabled ? displayRisk : selection.risk,
            aggregationMode: selection.aggregationMode,
            membershipMode: selection.membershipMode,
            hasPValueFilter: true
        }),
        risk: preview.previewEnabled ? displayRisk : selection.risk
    });
}

function plotExplorerSpatialHeatmap(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        setExplorerStatus("explorerSpatialStatus", "Data is still loading. Please wait and try again.");
        return;
    }

    const selection = getSpatialExplorerSelection();
    const { rhoBand, deStatus, membershipMode, aggregationMode, filteredGenes, rankedGenes, deListRequiredButMissing } = selection;

    if(deListRequiredButMissing){
        alert("Differential-expression gene list was not loaded. Check the DE list filename in data loading configuration.");
        setExplorerStatus("explorerSpatialStatus", "DE list not loaded. Verify heatmap_order_20260326.txt is accessible.");
        return;
    }

    if(filteredGenes.length === 0){
        alert("No genes matched the selected spatial filters.");
        setExplorerStatus("explorerSpatialStatus", "0 genes matched the selected filters.");
        return;
    }

    const preview = applyTopNPreview(rankedGenes, "explorerSpatialTopNEnabled", "explorerSpatialTopN");
    const genesToPlot = preview.displayGenes;
    if(genesToPlot.length === 0){
        setExplorerStatus("explorerSpatialStatus", "Preview returned no genes. Increase N or disable top-N preview.");
        return;
    }

    const rhoLabel = rhoBand === "all"
        ? "all rho"
        : rhoBand === "neg" ? "rho < -0.5"
        : rhoBand === "mid" ? "-0.5 <= rho <= 0.5"
        : "rho > 0.5";
    const deLabel = deStatus === "all"
        ? "all genes"
        : deStatus === "de" ? "DE only" : "non-DE only";

    plotSpatialHeatmap(genesToPlot, {
        membershipMode,
        aggregationMode,
        plotContext: {
            source: "explorer"
        },
        plotTitle: `Spatial Explorer Heatmap - ${rhoLabel}, ${deLabel}`
    });
    const heavyNote = selection.risk === "high" ? " Full selection is large; preview mode is recommended." : "";
    const previewNote = preview.previewEnabled && genesToPlot.length < filteredGenes.length
        ? ` Showing top ${genesToPlot.length} of ${filteredGenes.length} matched genes.`
        : ` Plotted ${genesToPlot.length} genes.`;
    setExplorerStatus("explorerSpatialStatus", `${previewNote}${heavyNote}`.trim());
}

function hasMetricBelowThreshold(rows, metricName, threshold){
    if(!Array.isArray(rows) || rows.length === 0) return false;
    return rows.some(row => {
        const value = Number(row[metricName]);
        return !Number.isNaN(value) && value <= threshold;
    });
}

function getTemporalExplorerSelection(){
    const region = document.getElementById("explorerTemporalRegion")?.value || "p-psm";
    const membershipMode = document.getElementById("explorerTemporalMembership")?.value || "all";
    const aggregationMode = document.getElementById("explorerTemporalAggregation")?.value || "average";
    const selectedMetrics = getSelectedTemporalMetrics(".explorer-temporal-metric-checkbox");
    const pValueMetric = document.getElementById("explorerTemporalPValueMetric")?.value || "P_VALUE";
    const topNSortMode = document.getElementById("explorerTemporalTopNSort")?.value || "metric_asc";
    const thresholdRaw = document.getElementById("explorerTemporalPValueThreshold")?.value || "all";
    const threshold = thresholdRaw === "all" ? null : Number(thresholdRaw);

    const regionLower = String(region).toLowerCase();
    const regionMatch = (row) => row.time >= 0 && row.region && String(row.region).toLowerCase() === regionLower;

    const geneRowsByGene = new Map();
    const ensureGeneRowsEntry = (geneLower) => {
        if(!geneRowsByGene.has(geneLower)){
            geneRowsByGene.set(geneLower, {rnaRows: [], protRows: []});
        }
        return geneRowsByGene.get(geneLower);
    };

    RNA_DATA.forEach(row => {
        if(!row || !row.ID || !regionMatch(row)) return;
        const geneLower = String(row.ID).toLowerCase();
        ensureGeneRowsEntry(geneLower).rnaRows.push(row);
    });

    PROT_DATA.forEach(row => {
        if(!row || !row.ID || !regionMatch(row)) return;
        const geneLower = String(row.ID).toLowerCase();
        ensureGeneRowsEntry(geneLower).protRows.push(row);
    });

    const baseGenes = Array.from(geneRowsByGene.keys()).filter(geneLower => {
        const pair = geneRowsByGene.get(geneLower);
        if(membershipMode === "both") return pair.rnaRows.length > 0 && pair.protRows.length > 0;
        return pair.rnaRows.length > 0 || pair.protRows.length > 0;
    });

    const sigDataset = document.getElementById("explorerTemporalSignificanceDataset")?.value || "either";

    const filteredGenes = baseGenes.filter(geneLower => {
        const pair = geneRowsByGene.get(geneLower);
        const rnaRows = pair.rnaRows;
        const protRows = pair.protRows;

        if(threshold === null || Number.isNaN(threshold)) return true;
        const rnaSig = hasMetricBelowThreshold(rnaRows, pValueMetric, threshold);
        const protSig = hasMetricBelowThreshold(protRows, pValueMetric, threshold);
        if(sigDataset === "both")     return rnaSig && protSig;
        if(sigDataset === "rna_only") return rnaSig && !protSig;
        if(sigDataset === "prot_only") return !rnaSig && protSig;
        return rnaSig || protSig; // "either"
    });

    const rankedGenes = sortTemporalGenesByMode(filteredGenes, topNSortMode, geneRowsByGene, pValueMetric);

    const datasetCount = membershipMode === "both" ? 2 : 2;
    const exprColumnCount = aggregationMode === "samples"
        ? Math.max(
            4,
            new Set([
                ...Array.from(geneRowsByGene.values()).flatMap(pair => pair.rnaRows.map(d => d.sample).filter(Boolean)),
                ...Array.from(geneRowsByGene.values()).flatMap(pair => pair.protRows.map(d => d.sample).filter(Boolean))
            ]).size
        )
        : 4;
    const metricColumnCount = selectedMetrics.length;
    const estimatedColumns = (exprColumnCount + metricColumnCount) * datasetCount;
    const estimatedCells = filteredGenes.length * estimatedColumns;
    const risk = getExplorerRiskLabel(estimatedCells);

    return {
        region,
        membershipMode,
        aggregationMode,
        selectedMetrics,
        pValueMetric,
        threshold,
        filteredGenes,
        rankedGenes,
        topNSortMode,
        estimatedColumns,
        estimatedCells,
        risk
    };
}

function updateTemporalExplorerPreview(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        setExplorerFeedback("explorerTemporalEstimate", "explorerTemporalAdvice", {
            estimateText: "Loading data...",
            adviceText: "Preview will update as soon as data is available.",
            risk: "low"
        });
        return;
    }

    const selection = getTemporalExplorerSelection();
    const preview = applyTopNPreview(selection.rankedGenes, "explorerTemporalTopNEnabled", "explorerTemporalTopN");
    const displayCells = preview.displayGenes.length * selection.estimatedColumns;
    const displayRisk = getExplorerRiskLabel(displayCells);
    const thresholdText = selection.threshold === null
        ? "no threshold"
        : `${selection.pValueMetric} <= ${selection.threshold}`;

    setExplorerFeedback("explorerTemporalEstimate", "explorerTemporalAdvice", {
        estimateText: preview.previewEnabled
            ? `Selection preview: ${selection.filteredGenes.length} matched genes for ${selection.region} (${thresholdText}). Plot will show top ${preview.displayGenes.length} genes (~${displayCells.toLocaleString()} cells, ${displayRisk} load), sorted by ${selection.topNSortMode}.`
            : `Selection preview: ${selection.filteredGenes.length} genes, ~${selection.estimatedColumns} columns, ~${selection.estimatedCells.toLocaleString()} heatmap cells (${selection.risk} load) for ${selection.region} (${thresholdText}).`,
        adviceText: buildExplorerAdvice({
            risk: preview.previewEnabled ? displayRisk : selection.risk,
            aggregationMode: selection.aggregationMode,
            membershipMode: selection.membershipMode,
            hasPValueFilter: selection.threshold !== null
        }),
        risk: preview.previewEnabled ? displayRisk : selection.risk
    });
}

function plotExplorerTemporalHeatmap(){
    if(RNA_DATA.length === 0 || PROT_DATA.length === 0){
        alert("Data is still loading. Please wait a moment and try again.");
        setExplorerStatus("explorerTemporalStatus", "Data is still loading. Please wait and try again.");
        return;
    }

    const selection = getTemporalExplorerSelection();
    const { region, membershipMode, aggregationMode, selectedMetrics, pValueMetric, threshold, filteredGenes, rankedGenes } = selection;

    if(filteredGenes.length === 0){
        const thresholdText = threshold === null ? "" : ` with ${pValueMetric} <= ${threshold}`;
        alert(`No genes matched the selected spatiotemporal filters${thresholdText}.`);
        setExplorerStatus("explorerTemporalStatus", `0 genes matched the selected filters${thresholdText}.`);
        return;
    }

    const preview = applyTopNPreview(rankedGenes, "explorerTemporalTopNEnabled", "explorerTemporalTopN");
    const genesToPlot = preview.displayGenes;
    if(genesToPlot.length === 0){
        setExplorerStatus("explorerTemporalStatus", "Preview returned no genes. Increase N or disable top-N preview.");
        return;
    }

    const thresholdLabel = threshold === null ? "no p-value filter" : `${pValueMetric} <= ${threshold}`;
    renderTemporalHeatmapFromGenes(genesToPlot, region, {
        membershipMode,
        aggregationMode,
        selectedMetrics,
        plotContext: {
            source: "explorer",
            region
        },
        plotTitle: `Spatiotemporal Explorer Heatmap - ${region} (${thresholdLabel})`
    });
    const heavyNote = selection.risk === "high" ? " Full selection is large; preview mode is recommended." : "";
    const previewNote = preview.previewEnabled && genesToPlot.length < filteredGenes.length
        ? `Showing top ${genesToPlot.length} of ${filteredGenes.length} matched genes for ${region} (${thresholdLabel}).`
        : `Plotted ${genesToPlot.length} genes for ${region} (${thresholdLabel}).`;
    setExplorerStatus("explorerTemporalStatus", `${previewNote} ${heavyNote}`.trim());
}

function updateExplorerPreviews(){
    const activeMain = document.querySelector(".main-tab-content.active")?.id;
    if(activeMain !== "explorer") return;

    const activeSub = document.querySelector("#explorer .subtab-content.active")?.id;
    if(activeSub === "explorerSpatial"){
        updateSpatialExplorerPreview();
        return;
    }
    if(activeSub === "explorerTemporal"){
        updateTemporalExplorerPreview();
        return;
    }

    updateSpatialExplorerPreview();
}

// GO term helpers
const GO_TERM_GENES_CACHE = {};

function getGoIdFromInput(inputValue){
    const match = inputValue && inputValue.match(/(GO:\d{7})/i);
    return match ? match[1].toUpperCase() : null;
}

function getGoTermInfoFromInput(inputValue){
    const raw = String(inputValue || "").trim();
    const goId = getGoIdFromInput(raw) || "";
    if(!goId) return {goId: "", goName: ""};

    const pipeIndex = raw.indexOf("|");
    const goName = pipeIndex >= 0 ? raw.slice(pipeIndex + 1).trim() : "";
    return {goId, goName};
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
    const goInfo = getGoTermInfoFromInput(document.getElementById('goTermInput').value);
    const goId = goInfo.goId;
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
            plotContext: {
                source: "go",
                region: "all-regions",
                goId,
                goName: goInfo.goName
            },
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
    const goInfo = getGoTermInfoFromInput(document.getElementById('goTermInputTemporal').value);
    const goId = goInfo.goId;
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
            plotContext: {
                source: "go",
                region,
                goId,
                goName: goInfo.goName
            },
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

    const genes = parseGeneInput(inputGenes);
    if(genes.length === 0){
        alert("Enter genes");
        return;
    }

    const aggregationMode = optionsOverride?.aggregationMode || getAggregationMode("temporalAggregation");
    const membershipMode = optionsOverride?.membershipMode || getHeatmapGeneMembership("temporalGeneMembership");
    const selectedMetrics = optionsOverride?.selectedMetrics || getSelectedTemporalMetrics();
    const pValueFilterMode = optionsOverride?.pValueFilterMode || (document.getElementById("temporalPValueFilter")?.value || "all");
    const plotContext = optionsOverride?.plotContext || {};
    setCurrentPlotMetadata({
        modality: "spatiotemporal",
        view: "heatmap",
        source: plotContext.source || "manual",
        region,
        goId: plotContext.goId || "",
        goName: plotContext.goName || ""
    });
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

    const normalizeZValue = (value, zmin, zmax) => {
        if(Number.isNaN(value)) return NaN;
        if(!Number.isFinite(zmin) || !Number.isFinite(zmax) || zmax <= zmin) return NaN;
        const normalized = (value - zmin) / (zmax - zmin);
        return Math.max(0, Math.min(1, normalized));
    };

    const getMetricCellTextColor = (metric, zValue, scaleConfig) => {
        const norm = normalizeZValue(zValue, scaleConfig.zmin, scaleConfig.zmax);
        if(Number.isNaN(norm)) return "#111";

        if(metric === "P_VALUE" || metric === "Q_VALUE"){
            return norm <= 0.36 ? "#f8f9ff" : "#111";
        }
        if(metric === "LAG"){
            return norm <= 0.24 ? "#f8f9ff" : "#111";
        }
        if(metric === "PERIOD"){
            return (norm <= 0.22 || norm >= 0.75) ? "#f8f9ff" : "#111";
        }
        return (norm <= 0.16 || norm >= 0.84) ? "#f8f9ff" : "#111";
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

    const heatmapHeight = Math.max(400, 265 + (geneLabels.length * 14));
    const yTickFontSize = geneLabels.length > 250 ? 8 : (geneLabels.length > 120 ? 9 : 10);
    const weights = subplots.map(slot => {
        if(slot.kind === "expr") return 1;
        return 0.33;
    });
    const subplotCount = Math.max(1, subplots.length);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const columnGap = subplotCount > 1 ? 0.015 : 0;
    const totalGap = columnGap * Math.max(0, subplotCount - 1);
    const usableDomain = Math.max(0.2, 1 - totalGap);
    const subplotDomains = [];
    let currentStart = 0;
    weights.forEach((weight, index) => {
        const width = (weight / totalWeight) * usableDomain;
        const start = currentStart;
        const end = Math.min(1, start + width);
        subplotDomains.push([start, end]);
        currentStart = end + (index < subplotCount - 1 ? columnGap : 0);
    });

    const customPlotTitle = optionsOverride?.plotTitle;
    const regionHeaderLabel = normalizeTemporalRegionKey(region);
    const topMargin = 24;
    const temporalColorbarCount = (rnaHasData || protHasData ? 1 : 0) + selectedMetrics.length;
    const temporalColorbarColumns = temporalColorbarCount > 3 ? 2 : 1;
    const temporalColorbarRows = Math.ceil(Math.max(1, temporalColorbarCount) / temporalColorbarColumns);
    const bottomMargin = 125 + (temporalColorbarRows * 34);
    const regionAlreadyInTitle = customPlotTitle
        ? customPlotTitle.toLowerCase().includes(regionHeaderLabel.toLowerCase())
        : false;
    const headerTitle = customPlotTitle
        ? (regionAlreadyInTitle ? customPlotTitle : `${customPlotTitle} - ${regionHeaderLabel}`)
        : `Spatiotemporal Expression Heatmap - ${regionHeaderLabel}`;

    setCurrentPlotMetadata({
        modality: "spatiotemporal",
        view: "heatmap",
        source: plotContext.source || "manual",
        region,
        goId: plotContext.goId || "",
        goName: plotContext.goName || "",
        headerStrip: {
            kind: "temporal-expression",
            aggregationMode,
            region,
            title: headerTitle,
            timepoints: xDisplayLabels,
            leftMargin: 230,
            rightMargin: 80,
            columns: subplots.map(slot => ({
                kind: slot.kind,
                dataset: slot.dataset,
                label: slot.title,
                weight: slot.kind === "expr" ? 1 : 0.33
            }))
        }
    });

    const layout = {
        title: '',
        height: heatmapHeight,
        margin: {l: 230, r: 80, t: topMargin, b: bottomMargin}
    };

    console.info('[TemporalHeatmap] Domain summary:', {
        subplotCount,
        weights,
        columnGap,
        subplotDomains
    });

    const buildDomainColorbar = (domain, titleText) => {
        const start = domain[0];
        const end = domain[1];
        const width = Math.max(0.08, end - start);

        return {
            title: {text: titleText, side: 'top', font: {size: 10}},
            orientation: 'h',
            x: (start + end) / 2,
            xanchor: 'center',
            y: -0.07,
            yanchor: 'top',
            len: Math.max(0.08, width * 0.9),
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
        const isExpression = slot.kind === "expr";

        layout[layoutXKey] = {
            title: isExpression
                ? ''
                : '',
            type: 'category',
            domain: subplotDomains[i],
            anchor: yKey,
            tickangle: -45,
            showticklabels: false,
            ticks: '',
            ticklen: 0
        };
        layout[layoutYKey] = {
            title: i === 0 ? 'Genes' : '',
            type: 'category',
            domain: [0, 1],
            anchor: xKey,
            automargin: true,
            categoryorder: 'array',
            categoryarray: geneLabels,
            showticklabels: i === 0,
            tickfont: {size: yTickFontSize},
            ticks: '',
            ticklen: 0
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
                showscale: true,
                colorbar: buildDomainColorbar(subplotDomains[i], 'Z-score')
            });
        } else {
            const metricValues = buildMetricColumn(slot.dataset, slot.metric);
            const metricZValues = getMetricZValues(slot.metric, metricValues);
            const scaleConfig = getMetricScaleConfig(slot.metric);
            const metricText = metricValues.map((v, rowIndex) => {
                const rawText = formatMetricCell(v);
                if(!rawText) return "";
                const textColor = getMetricCellTextColor(slot.metric, metricZValues[rowIndex], scaleConfig);
                return `<span style=\"color:${textColor};font-weight:600\">${rawText}</span>`;
            });
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
                textfont: {size: 10},
                customdata: metricValues.map(v => [v]),
                hovertemplate: slot.metric === "PERIOD"
                    ? "%{y}<br>PERIOD: %{customdata[0]:.3f}<br>|Δ130|: %{z:.3f}<extra></extra>"
                    : "%{y}<br>" + slot.metric + ": %{customdata[0]:.3f}<extra></extra>",
                showscale: true,
                colorbar: buildDomainColorbar(subplotDomains[i], scaleConfig.colorbarTitle)
            });
        }

    });

    try {
        plotWithResponsiveSizing("plot", traces, layout);
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
            weights,
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
        : document.getElementById("temporalGenes").value;
    const region = regionOverride || document.getElementById("heatmapRegion").value;
    return renderTemporalHeatmapFromGenes(genes, region, optionsOverride);
}

// Expose key functions to the global scope (for inline onclick handlers)
window.searchGoTerm = searchGoTerm;
window.plotGoSpatialHeatmap = plotGoSpatialHeatmap;
window.plotGoTemporalHeatmap = plotGoTemporalHeatmap;
window.plotSpatial = plotSpatial;
window.plotSpatialHeatmap = plotSpatialHeatmap;
window.plotExplorerSpatialHeatmap = plotExplorerSpatialHeatmap;
window.plotTemporal = plotTemporal;
window.plotTemporalHeatmap = plotTemporalHeatmap;
window.plotExplorerTemporalHeatmap = plotExplorerTemporalHeatmap;
window.updateExplorerPreviews = updateExplorerPreviews;
window.fetchGoTermSuggestions = fetchGoTermSuggestions;
window.populateGoTermsDatalist = populateGoTermsDatalist;
window.clearExplorerPlot = clearExplorerPlot;
window.restorePlotStateForView = restorePlotStateForView;
window.savePlotStateForView = savePlotStateForView;
