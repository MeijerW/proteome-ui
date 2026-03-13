function openMainTab(id){

document
.querySelectorAll(".main-tab-content")
.forEach(t=>t.classList.remove("active"))

document
.getElementById(id)
.classList.add("active")

}

function openSubTab(id){

document
.querySelectorAll(".subtab-content")
.forEach(t=>t.classList.remove("active"))

document
.getElementById(id)
.classList.add("active")

}