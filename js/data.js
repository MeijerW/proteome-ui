const BASE =
"https://raw.githubusercontent.com/MeijerW/ProteomeUI/main/Datafiles/"

let RNA_DATA = []
let PROT_DATA = []

async function loadData(){

// RNA files
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
    // Add region to each row
    data.forEach(row => row.region = file.region)
    RNA_DATA = RNA_DATA.concat(data)
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
    // Add region to each row
    data.forEach(row => row.region = file.region)
    PROT_DATA = PROT_DATA.concat(data)
}

}

loadData()