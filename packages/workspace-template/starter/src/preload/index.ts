import { contextBridge } from 'electron'

const starterApi = {
  platform: process.platform
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('starterApi', starterApi)
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.starterApi = starterApi
}
