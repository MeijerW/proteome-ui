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
    updateTemporalGenes();
    // Set up starts-with autocomplete for both gene inputs (replaces full-list datalist)
    setupGeneStartsWithFilter('spatialGene', 'genes', () => geneList);
    setupGeneStartsWithFilter('temporalGene', 'genes-temporal', () => geneListTemporal);
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

// Filters the gene datalist to only genes that START WITH the current input value.
// This replaces the browser's default contains-matching with a stricter prefix match.
function setupGeneStartsWithFilter(inputId, datalistId, getList){
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);
    if(!input || !datalist) return;

    const refresh = () => {
        const query = input.value.trim().toLowerCase();
        datalist.innerHTML = '';
        if(!query) return; // show nothing until the user starts typing
        const list = getList();
        list
            .filter(g => g.toLowerCase().startsWith(query))
            .slice(0, 200)
            .forEach(gene => {
                const opt = document.createElement('option');
                opt.value = gene;
                datalist.appendChild(opt);
            });
    };

    datalist.innerHTML = ''; // clear any pre-populated options so browser can't show them
    input.addEventListener('input', refresh);
}

function updateTemporalGenes(){
    const region = document.getElementById('region').value || document.getElementById('heatmapRegion').value;
    geneListTemporal = [...new Set(RNA_DATA.filter(d => d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d => d.ID).filter(g => g))].sort();
    // Trigger the starts-with filter to refresh with the new region's gene list
    const input = document.getElementById('temporalGene');
    if(input) input.dispatchEvent(new Event('input'));
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
