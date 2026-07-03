import * as React from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'

const switchStyles = {
  width: 56,
  height: 32,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    margin: 0,
    padding: 4,
    transitionDuration: '180ms',
    '&.Mui-checked': {
      transform: 'translateX(24px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: 'var(--accent-soft)',
        borderColor: 'var(--accent-line)'
      }
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      outline: '2px solid var(--accent-line)',
      outlineOffset: 2
    }
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 24,
    height: 24,
    backgroundColor: '#ffffff',
    boxShadow: '0 8px 18px rgba(15,23,42,0.22)'
  },
  '& .MuiSwitch-track': {
    borderRadius: 16,
    opacity: 1,
    border: '1px solid color-mix(in srgb, var(--line) 80%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--panel-2) 18%, transparent)'
  }
} as const

const Switch = React.forwardRef<HTMLButtonElement, MuiSwitchProps>(({ sx, ...props }, ref) => (
  <MuiSwitch
    ref={ref}
    disableRipple
    sx={[switchStyles, ...(Array.isArray(sx) ? sx : [sx])]}
    {...props}
  />
))

Switch.displayName = 'Switch'

export { Switch }
export type { MuiSwitchProps as SwitchProps }
