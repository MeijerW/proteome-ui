const BASE =
"https://raw.githubusercontent.com/MeijerW/ProteomeUI/main/Datafiles/"

let RNA_DATA = []
let PROT_DATA = []

async function loadData(){

// Load spatial data from CSV
const rnaCsv = await fetch(BASE+"RNA_preprocessed.csv")
const rnaCsvText = await rnaCsv.text()
const rnaCsvData = Papa.parse(rnaCsvText,{
header:true,
dynamicTyping:true,
skipEmptyLines:true
}).data
RNA_DATA = rnaCsvData.map(row => ({
    ID: row.Gene,
    group: row.group,
    "Z-score": row["Z-score"]
}))

const protCsv = await fetch(BASE+"Protein_preprocessed.csv")
const protCsvText = await protCsv.text()
const protCsvData = Papa.parse(protCsvText,{
header:true,
dynamicTyping:true,
skipEmptyLines:true
}).data
PROT_DATA = protCsvData.map(row => ({
    ID: row.Gene,
    group: row.group,
    "Z-score": row["Z-score"]
}))

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