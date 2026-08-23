/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        workspace: 'var(--workspace-background)',
        panel: {
          DEFAULT: 'var(--panel)',
          hover: 'var(--panel-hover)'
        },
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          hover: 'var(--card-hover)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
          hover: 'var(--popover-hover)'
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          hover: 'var(--accent-hover)'
        },
        progress: 'var(--progress)',
        milestone: {
          current: 'var(--milestone-current-icon)',
          complete: 'var(--milestone-complete-icon)',
          unreached: 'var(--milestone-unreached-icon)'
        },
        'surface-subtle': {
          DEFAULT: 'var(--surface-subtle)',
          foreground: 'var(--surface-subtle-foreground)',
          hover: 'var(--surface-subtle-hover)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)'
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
          border: 'var(--success-border)',
          muted: 'var(--success-muted)',
          'muted-foreground': 'var(--success-muted-foreground)'
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
          border: 'var(--warning-border)',
          muted: 'var(--warning-muted)',
          'muted-foreground': 'var(--warning-muted-foreground)'
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
          border: 'var(--info-border)',
          muted: 'var(--info-muted)',
          'muted-foreground': 'var(--info-muted-foreground)'
        },
        overlay: {
          DEFAULT: 'var(--overlay)',
          muted: 'var(--overlay-muted)'
        },
        'destructive-muted': {
          DEFAULT: 'var(--destructive-muted)',
          foreground: 'var(--destructive-muted-foreground)'
        },
        border: 'var(--border)',
        'panel-border': 'var(--panel-border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)'
        }
      },
      borderRadius: {
        dialog: 'var(--radius-dialog)',
        shell: 'var(--radius-shell)',
        surface: 'var(--radius-surface)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      borderWidth: {
        DEFAULT: 'var(--border-width)'
      },
      divideWidth: {
        DEFAULT: 'var(--border-width)'
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
