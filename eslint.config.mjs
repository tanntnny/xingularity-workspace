import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ignores: ['src/renderer/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mui/material',
              message: 'Import app-owned primitives from components/ui instead of MUI directly.'
            },
            {
              name: '@mui/material/ButtonBase',
              message: 'Import app-owned primitives from components/ui instead of MUI directly.'
            },
            {
              name: '@mui/material/Switch',
              message: 'Import app-owned primitives from components/ui instead of MUI directly.'
            }
          ],
          patterns: [
            {
              group: ['@radix-ui/*'],
              message: 'Import app-owned primitives from components/ui instead of Radix directly.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['packages/workspace-template/src/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'react/prop-types': 'off',
      'react-hooks/purity': 'off',
      'react-refresh/only-export-components': 'off'
    }
  },
  eslintConfigPrettier
)
