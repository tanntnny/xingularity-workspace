import * as React from 'react'
import MuiButtonBase, { type ButtonBaseProps as MuiButtonBaseProps } from '@mui/material/ButtonBase'

const Pressable = React.forwardRef<HTMLButtonElement, MuiButtonBaseProps>(
  ({ disableRipple = true, ...props }, ref) => (
    <MuiButtonBase ref={ref} disableRipple={disableRipple} {...props} />
  )
)

Pressable.displayName = 'Pressable'

export { Pressable }
