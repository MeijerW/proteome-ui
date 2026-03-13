const BASE =
"https://raw.githubusercontent.com/MeijerW/ProteomeUI/main/Datafiles/"

async function loadCSV(file){

    const response = await fetch(BASE + file)
    const text = await response.text()

    const parsed = Papa.parse(text,{
        header:true,
        dynamicTyping:true,
        skipEmptyLines:true
    })

    return parsed.data.filter(r => r.Gene)
}