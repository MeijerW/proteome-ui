let geneList = []
let geneListTemporal = []
let goAutocompleteTimer = null
let goAutocompleteRequestId = 0

async function loadGenes(){
    // Wait for data to load
    while(RNA_DATA.length === 0){
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    geneList = [...new Set(RNA_DATA.map(d => d.ID).filter(g => g))].sort();
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
    geneListTemporal = [...new Set(RNA_DATA.filter(d => d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d => d.ID).filter(g => g))].sort();
    populateDatalist('genes-temporal', geneListTemporal);
}

document.getElementById('region').addEventListener('change', updateTemporalGenes);
document.getElementById('heatmapRegion').addEventListener('change', updateTemporalGenes);

function syncGoInputs(sourceId){
    const source = document.getElementById(sourceId);
    const otherId = sourceId === 'goTermInput' ? 'goTermInputTemporal' : 'goTermInput';
    const other = document.getElementById(otherId);
    if(source && other){
        other.value = source.value;
    }
}

function setupGoAutocomplete(){
    const inputIds = ['goTermInput', 'goTermInputTemporal'];

    const requestSuggestions = (sourceId) => {
        const input = document.getElementById(sourceId);
        if(!input || typeof window.fetchGoTermSuggestions !== 'function') return;

        const query = input.value.trim();
        syncGoInputs(sourceId);

        if(query.length < 2){
            if(query.length === 0 && typeof window.populateGoTermsDatalist === 'function'){
                window.populateGoTermsDatalist([]);
            }
            return;
        }

        const requestId = ++goAutocompleteRequestId;
        clearTimeout(goAutocompleteTimer);
        goAutocompleteTimer = setTimeout(async () => {
            try {
                const data = await window.fetchGoTermSuggestions(query, 25);
                if(requestId !== goAutocompleteRequestId) return;
                if(typeof window.populateGoTermsDatalist === 'function'){
                    window.populateGoTermsDatalist(data.results || []);
                }
            } catch (err){
                console.warn('GO autocomplete failed:', err);
            }
        }, 250);
    };

    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if(!input) return;
        input.addEventListener('input', () => requestSuggestions(id));
        input.addEventListener('focus', () => requestSuggestions(id));
        input.addEventListener('change', () => syncGoInputs(id));
    });
}

loadGenes();
setupGoAutocomplete();
