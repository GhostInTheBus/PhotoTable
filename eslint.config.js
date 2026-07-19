import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const browserGlobals = {
  Blob: 'readonly',
  CSS: 'readonly',
  DOMMatrix: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FileSystemDirectoryEntry: 'readonly',
  FileSystemDirectoryHandle: 'readonly',
  FileSystemEntry: 'readonly',
  FileSystemFileEntry: 'readonly',
  FileSystemFileHandle: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLImageElement: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  PointerEvent: 'readonly',
  React: 'readonly',
  Uint8Array: 'readonly',
  URL: 'readonly',
  atob: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  Image: 'readonly',
  localStorage: 'readonly',
  requestAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  window: 'readonly',
}

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '@eaDir/**', '.playwright-browsers/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: { console: 'readonly' },
    },
  }
)
