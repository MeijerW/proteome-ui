let geneList = []

async function loadGenes(){
    // Wait for data to load
    while(RNA_DATA.length === 0){
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    geneList = [...new Set(RNA_DATA.map(d => d.Gene).filter(g => g))].sort();
    populateDatalist();
}

function populateDatalist(){
    const datalist = document.getElementById('genes');
    if(datalist){
        datalist.innerHTML = '';
        geneList.forEach(gene => {
            const option = document.createElement('option');
            option.value = gene;
            datalist.appendChild(option);
        });
    }
}

loadGenes();
