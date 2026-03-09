import { RendererVaultApi } from '../shared/types'

declare global {
  interface Window {
    vaultApi: RendererVaultApi
  }
}

export {}
