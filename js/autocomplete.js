let geneList = []
let geneListTemporal = []

async function loadGenes(){
    // Wait for data to load
    while(RNA_DATA.length === 0){
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    geneList = [...new Set(RNA_DATA.map(d => d.Gene).filter(g => g))].sort();
    populateDatalist('genes', geneList);
    updateTemporalGenes();
}

function populateDatalist(id, list){
    const datalist = document.getElementById(id);
    if(datalist){
        datalist.innerHTML = '';
        list.forEach(gene => {
            const option = document.createElement('option');
            option.value = gene;
            datalist.appendChild(option);
        });
    }
}

function updateTemporalGenes(){
    const region = document.getElementById('region').value || document.getElementById('heatmapRegion').value;
    geneListTemporal = [...new Set(RNA_DATA.filter(d => d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d => d.Gene).filter(g => g))].sort();
    populateDatalist('genes-temporal', geneListTemporal);
}

document.getElementById('region').addEventListener('change', updateTemporalGenes);
document.getElementById('heatmapRegion').addEventListener('change', updateTemporalGenes);

loadGenes();
