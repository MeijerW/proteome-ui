function heatmap(matrix,genes,times){

let data=[{

z:matrix,
x:times,
y:genes,
type:"heatmap",
colorscale:"Viridis"

}]

Plotly.newPlot("plot",data,{
title:"Expression Heatmap",
height: 600,
width: 800
})

}
