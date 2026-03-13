let geneList = []

async function loadGenes(){

let data = await loadCSV("RNA_preprocessed.csv")

geneList =
[...new Set(data.map(d => d.Gene))]

}

function autocomplete(input){

input.addEventListener("input",function(){

let val = this.value.toLowerCase()

let matches =
geneList.filter(g =>
g.toLowerCase().startsWith(val)
)

console.log(matches.slice(0,10))

})

}

loadGenes()
autocomplete(document.getElementById("geneInput"))
