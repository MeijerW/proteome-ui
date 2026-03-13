const BASE =
"https://raw.githubusercontent.com/MeijerW/ProteomeUI/main/Datafiles/"

let RNA_DATA = []
let PROT_DATA = []

async function loadData(){

const rna = await fetch(BASE+"RNA_preprocessed.csv")
const rnaText = await rna.text()

RNA_DATA =
Papa.parse(rnaText,{
header:true,
dynamicTyping:true,
skipEmptyLines:true
}).data

const prot = await fetch(BASE+"Protein_preprocessed.csv")
const protText = await prot.text()

PROT_DATA =
Papa.parse(protText,{
header:true,
dynamicTyping:true,
skipEmptyLines:true
}).data

}

loadData()