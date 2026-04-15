const BASE =
"https://raw.githubusercontent.com/MeijerW/Meijer-proteomics-data/main/Datafiles/"

let RNA_DATA = []
let PROT_DATA = []
let RHO_CORRELATION_DATA = new Map()

const SPATIAL_DATASETS = {
    RNA: "rna_zscore_long.csv",
    PROTEIN: "prot_zscore_long.csv",
    RHO: "Rho-correlation.txt"
}

function cleanQuotedValue(value){
    return String(value || "").trim().replace(/^"|"$/g, "");
}

function parseRhoCorrelationText(text){
    const rhoMap = new Map();
    const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(line => line);

    lines.forEach((line, index) => {
        if(index === 0 && cleanQuotedValue(line).toLowerCase() === "diag") return;

        const parts = line.split('\t');
        if(parts.length < 2) return;

        const gene = cleanQuotedValue(parts[0]);
        const rhoValue = Number(parts[parts.length - 1]);
        if(!gene || Number.isNaN(rhoValue)) return;

        rhoMap.set(gene.toLowerCase(), {
            gene,
            value: rhoValue
        });
    });

    return rhoMap;
}

function getSpatialExpressionValue(row){
    const candidates = [
        row["Z-score"],
        row["Z_score"],
        row["z_score"],
        row["zscore"],
        row["ZScore"],
        row["zScore"],
        row.value,
        row.VALUE
    ];

    const match = candidates.find(value => value !== undefined && value !== null && value !== "");
    if(match === undefined) return NaN;

    const numericValue = Number(match);
    return Number.isNaN(numericValue) ? NaN : numericValue;
}

function parseSpatialCsv(text){
    const rows = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    }).data;

    return rows.map(row => ({
        ID: row.Gene || row.ID,
        group: row.group || row.Group || row.region || row.Region,
        sample: row.sample || row.Sample || null,
        replicate: row.replicate || row.Replicate || null,
        spatialValue: getSpatialExpressionValue(row)
    }));
}

async function loadData(){

// Load pre-z-scored spatial data from CSV
const rnaCsv = await fetch(BASE + SPATIAL_DATASETS.RNA)
if(!rnaCsv.ok){
throw new Error(`Failed to load ${SPATIAL_DATASETS.RNA}: HTTP ${rnaCsv.status}`)
}
const rnaCsvText = await rnaCsv.text()
RNA_DATA = parseSpatialCsv(rnaCsvText)

const protCsv = await fetch(BASE + SPATIAL_DATASETS.PROTEIN)
if(!protCsv.ok){
throw new Error(`Failed to load ${SPATIAL_DATASETS.PROTEIN}: HTTP ${protCsv.status}`)
}
const protCsvText = await protCsv.text()
PROT_DATA = parseSpatialCsv(protCsvText)

const rhoFile = await fetch(BASE + SPATIAL_DATASETS.RHO)
if(!rhoFile.ok){
throw new Error(`Failed to load ${SPATIAL_DATASETS.RHO}: HTTP ${rhoFile.status}`)
}
const rhoText = await rhoFile.text()
RHO_CORRELATION_DATA = parseRhoCorrelationText(rhoText)

// Load spatiotemporal data from TSV and add
const rnaFiles = [
    {url: "Table-S5_Biocycle-results_RNAseq_a-PSM.tsv", region: "Anterior"},
    {url: "Table-S6_Biocycle-results_RNAseq_p-PSM.tsv", region: "Posterior"},
    {url: "Table-S7_Biocycle-results_RNAseq_Somite.tsv", region: "Somite"}
]

for (const file of rnaFiles) {
    const response = await fetch(BASE + file.url)
    const text = await response.text()
    const data = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: '\t'
    }).data
    // Pivot to long format (include all replicates per timepoint)
    const times = [30, 60, 90, 120];
    data.forEach(row => {
        times.forEach(time => {
            const repKeys = Object.keys(row).filter(k => k.startsWith(`TP_${time}_REP_`));
            repKeys.forEach(key => {
                const value = row[key];
                if (value !== undefined && value !== null) {
                    RNA_DATA.push({
                        ID: row.ID,
                        region: file.region,
                        group: file.region,
                        time: time,
                        sample: key,
                        value: value,
                        P_VALUE: row.P_VALUE,
                        Q_VALUE: row.Q_VALUE,
                        PERIOD: row.PERIOD,
                        LAG: row.LAG,
                        AMPLITUDE: row.AMPLITUDE,
                        OFFSET: row.OFFSET,
                        MEAN_PERIODICITY: row.MEAN_PERIODICITY,
                        SCATTER: row.SCATTER
                    });
                }
            });
        });
    });
}

// Protein files
const protFiles = [
    {url: "Table-S2_Biocycle-results_Protein_a-PSM.tsv", region: "Anterior"},
    {url: "Table-S3_Biocycle-results_Protein_p-PSM.tsv", region: "Posterior"},
    {url: "Table-S4_Biocycle-results_Protein_Somite.tsv", region: "Somite"}
]

for (const file of protFiles) {
    const response = await fetch(BASE + file.url)
    const text = await response.text()
    const data = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: '\t'
    }).data
    // Pivot to long format (include all replicates per timepoint)
    const times = [30, 60, 90, 120];
    data.forEach(row => {
        times.forEach(time => {
            const repKeys = Object.keys(row).filter(k => k.startsWith(`TP_${time}_REP_`));
            repKeys.forEach(key => {
                const value = row[key];
                if (value !== undefined && value !== null) {
                    PROT_DATA.push({
                        ID: row.ID,
                        region: file.region,
                        group: file.region,
                        time: time,
                        sample: key,
                        value: value,
                        P_VALUE: row.P_VALUE,
                        Q_VALUE: row.Q_VALUE,
                        PERIOD: row.PERIOD,
                        LAG: row.LAG,
                        AMPLITUDE: row.AMPLITUDE,
                        OFFSET: row.OFFSET,
                        MEAN_PERIODICITY: row.MEAN_PERIODICITY,
                        SCATTER: row.SCATTER
                    });
                }
            });
        });
    });
}

}

loadData()