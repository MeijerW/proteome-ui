function openMainTab(id, button){

document
.querySelectorAll(".main-tab-content")
.forEach(t=>t.classList.remove("active"))

document
.getElementById(id)
.classList.add("active")

document
.querySelectorAll(".tab-button")
.forEach(b=>b.classList.remove("active"))

button.classList.add("active")

}

function openSubTab(id, button){

document
.querySelectorAll(".subtab-content")
.forEach(t=>t.classList.remove("active"))

document
.getElementById(id)
.classList.add("active")

document
.querySelectorAll(".subtab-button")
.forEach(b=>b.classList.remove("active"))

button.classList.add("active")

}

// Keyboard shortcuts: Enter behaves like clicking the associated action button
function setupKeyboardShortcuts(){
  const addEnter = (el, handler) => {
    if(!el) return;
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        handler();
      }
    });
  };

  const addCtrlEnter = (el, handler) => {
    if(!el) return;
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
        e.preventDefault();
        handler();
      }
    });
  };

  addEnter(document.getElementById('spatialGene'), plotSpatial);
  addEnter(document.getElementById('temporalGene'), plotTemporal);
  addEnter(document.getElementById('goTermInput'), () => searchGoTerm(false));
  addEnter(document.getElementById('goTermInputTemporal'), () => searchGoTerm(true));

  // In multi-line text areas, use Ctrl+Enter to generate plots
  addCtrlEnter(document.getElementById('spatialGenes'), plotSpatialHeatmap);
  addCtrlEnter(document.getElementById('temporalGenes'), () => plotTemporalHeatmap());
}

setupKeyboardShortcuts();
