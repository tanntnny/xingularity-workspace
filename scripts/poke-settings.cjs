const { ipcRenderer } = require('electron')

ipcRenderer.invoke('settings:get').then((settings) => {
  console.log(settings)
}).catch((err) => console.error(err))
