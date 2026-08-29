import * as React from 'react'

export const ResponsivePickerOpenContext = React.createContext(false)

export function useResponsivePickerOpen(): boolean {
  return React.useContext(ResponsivePickerOpenContext)
}
