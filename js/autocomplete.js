let geneList = []
let geneListTemporal = []
let goAutocompleteTimer = null
let goAutocompleteRequestId = 0
const goAutocompleteState = new Map()

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
    const regionNode = document.getElementById('region') || document.getElementById('heatmapRegion');
    const region = regionNode ? String(regionNode.value || '').trim() : '';
    if(!region){
        geneListTemporal = [];
        return;
    }
    geneListTemporal = [...new Set(RNA_DATA.filter(d => d.region && d.region.toLowerCase() === region.toLowerCase() && d.time >= 0).map(d => d.ID).filter(g => g))].sort();
    // Trigger the starts-with filter to refresh with the new region's gene list
    const input = document.getElementById('temporalGene');
    if(input) input.dispatchEvent(new Event('input'));
}

const regionSelect = document.getElementById('region');
if(regionSelect){
    regionSelect.addEventListener('change', updateTemporalGenes);
}

const heatmapRegionSelect = document.getElementById('heatmapRegion');
if(heatmapRegionSelect){
    heatmapRegionSelect.addEventListener('change', updateTemporalGenes);
}

function syncGoInputs(sourceId){
    const source = document.getElementById(sourceId);
    const otherId = sourceId === 'goTermInput' ? 'goTermInputTemporal' : 'goTermInput';
    const other = document.getElementById(otherId);
    if(source && other){
        other.value = source.value;
    }
}

function getGoAutocompleteKey(inputId){
    return inputId === 'goTermInputTemporal' ? 'goTermInputTemporal' : 'goTermInput';
}

function ensureGoSuggestionPanel(input){
    if(!input) return null;

    const panelId = `${input.id}-go-suggestions`;
    let panel = document.getElementById(panelId);
    if(panel) return panel;

    panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'go-autocomplete-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;

    input.insertAdjacentElement('afterend', panel);
    return panel;
}

function hideGoSuggestionPanel(inputId){
    const panel = document.getElementById(`${inputId}-go-suggestions`);
    if(panel) panel.hidden = true;
}

function selectGoSuggestion(inputId, suggestion){
    const input = document.getElementById(inputId);
    if(!input || !suggestion) return;

    const value = `${suggestion.id} | ${suggestion.name}`;
    input.value = value;
    syncGoInputs(inputId);
    hideGoSuggestionPanel(inputId);
}

function renderGoSuggestions(inputId, results, query){
    const input = document.getElementById(inputId);
    if(!input) return;

    const panel = ensureGoSuggestionPanel(input);
    if(!panel) return;

    panel.innerHTML = '';
    const trimmedQuery = String(query || '').trim();
    const list = Array.isArray(results) ? results.slice(0, 12) : [];

    if(trimmedQuery.length < 2){
        panel.hidden = true;
        return;
    }

    if(list.length === 0){
        const empty = document.createElement('div');
        empty.className = 'go-autocomplete-empty';
        empty.textContent = 'No GO terms found';
        panel.appendChild(empty);
        panel.hidden = false;
        return;
    }

    list.forEach(result => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'go-autocomplete-item';
        button.setAttribute('role', 'option');
        button.textContent = `${result.id} | ${result.name}`;
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            selectGoSuggestion(inputId, result);
        });
        button.addEventListener('click', event => {
            event.preventDefault();
            selectGoSuggestion(inputId, result);
        });
        panel.appendChild(button);
    });

    panel.hidden = false;
}

function setupGoAutocomplete(){
    const inputIds = ['goTermInput', 'goTermInputTemporal'];

    const handleOutsidePointerDown = (event) => {
        inputIds.forEach(inputId => {
            const input = document.getElementById(inputId);
            const panel = document.getElementById(`${inputId}-go-suggestions`);
            if(!input || !panel || panel.hidden) return;
            if(input.contains(event.target) || panel.contains(event.target)) return;
            hideGoSuggestionPanel(inputId);
        });
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);

    const requestSuggestions = (sourceId) => {
        const input = document.getElementById(sourceId);
        if(!input || typeof window.fetchGoTermSuggestions !== 'function') return;

        const query = input.value.trim();
        syncGoInputs(sourceId);

        if(query.length < 2){
            hideGoSuggestionPanel(sourceId);
            return;
        }

        const requestId = ++goAutocompleteRequestId;
        clearTimeout(goAutocompleteTimer);
        goAutocompleteTimer = setTimeout(async () => {
            try {
                const data = await window.fetchGoTermSuggestions(query, 25);
                if(requestId !== goAutocompleteRequestId) return;
                renderGoSuggestions(sourceId, data.results || [], query);
            } catch (err){
                console.warn('GO autocomplete failed:', err);
                hideGoSuggestionPanel(sourceId);
            }
        }, 250);
    };

    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if(!input) return;
        input.removeAttribute('list');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        ensureGoSuggestionPanel(input);
        input.addEventListener('input', () => requestSuggestions(id));
        input.addEventListener('focus', () => requestSuggestions(id));
        input.addEventListener('change', () => syncGoInputs(id));
        input.addEventListener('keydown', event => {
            if(event.key === 'Escape'){
                hideGoSuggestionPanel(id);
            }
        });
    });
}

loadGenes();
setupGoAutocomplete();
