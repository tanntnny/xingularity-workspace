import * as React from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import { switchStyles } from './switchStyles'

const Switch = React.forwardRef<HTMLButtonElement, MuiSwitchProps>(({ sx, ...props }, ref) => (
  <MuiSwitch ref={ref} sx={[switchStyles, ...(Array.isArray(sx) ? sx : [sx])]} {...props} />
))

Switch.displayName = 'Switch'

export { Switch }
export type { MuiSwitchProps as SwitchProps }
