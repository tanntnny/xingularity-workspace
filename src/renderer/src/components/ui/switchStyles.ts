export const switchStyles = {
  '& .MuiSwitch-switchBase': {
    color: 'var(--switch-thumb-off-color)'
  },
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: 'var(--switch-thumb-on-color)'
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    boxSizing: 'border-box',
    backgroundColor: 'var(--switch-track-off-bg)',
    border: '1px solid var(--switch-track-off-border)'
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)'
  },
  '& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track': {
    opacity: 0.45
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: 'currentColor'
  }
} as const
