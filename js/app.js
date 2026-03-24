function getActiveMainTabId(){
  const activeMain = document.querySelector(".main-tab-content.active");
  return activeMain ? activeMain.id : null;
}

function getActiveSubTabId(mainTabId = getActiveMainTabId()){
  if(!mainTabId) return null;
  const mainTab = document.getElementById(mainTabId);
  const activeSub = mainTab ? mainTab.querySelector(".subtab-content.active") : null;
  return activeSub ? activeSub.id : null;
}

function getCurrentViewKey(){
  const mainTabId = getActiveMainTabId();
  const subTabId = getActiveSubTabId(mainTabId);
  return mainTabId && subTabId ? `${mainTabId}:${subTabId}` : null;
}

function restoreCurrentViewPlot(){
  if(typeof window.restorePlotStateForView !== 'function') return;
  window.restorePlotStateForView(getCurrentViewKey());
}

function openMainTab(id, button){

const previousViewKey = getCurrentViewKey();
if(previousViewKey && typeof window.savePlotStateForView === 'function'){
window.savePlotStateForView(previousViewKey)
}

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

restoreCurrentViewPlot()

}

function openSubTab(id, button){

const previousViewKey = getCurrentViewKey();
if(previousViewKey && typeof window.savePlotStateForView === 'function'){
window.savePlotStateForView(previousViewKey)
}

const currentMainTab = document.querySelector(".main-tab-content.active");
if(!currentMainTab) return;

currentMainTab
.querySelectorAll(".subtab-content")
.forEach(t=>t.classList.remove("active"))

document
.getElementById(id)
.classList.add("active")

currentMainTab
.querySelectorAll(".subtab-button")
.forEach(b=>b.classList.remove("active"))

button.classList.add("active")

restoreCurrentViewPlot()

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

function setupPValueFilterControls(){
  const bindPValueToggle = (checkboxSelector, wrapperId) => {
    const checkboxes = Array.from(document.querySelectorAll(checkboxSelector));
    const wrapper = document.getElementById(wrapperId);
    if(checkboxes.length === 0 || !wrapper) return;

    const update = () => {
      const hasPValueSelected = checkboxes.some(cb => cb.value === 'P_VALUE' && cb.checked);
      wrapper.style.display = hasPValueSelected ? 'block' : 'none';
    };

    checkboxes.forEach(cb => cb.addEventListener('change', update));
    update();
  };

  bindPValueToggle('.temporal-metric-checkbox', 'temporalPValueFilterWrap');
  bindPValueToggle('.go-temporal-metric-checkbox', 'goTemporalPValueFilterWrap');
}

setupKeyboardShortcuts();
setupPValueFilterControls();

window.getCurrentViewKey = getCurrentViewKey;
