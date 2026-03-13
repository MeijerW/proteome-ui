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