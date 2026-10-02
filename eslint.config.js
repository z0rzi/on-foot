const expoConfig = require('eslint-config-expo/flat')
const tseslint = require('typescript-eslint')
const globals = require('globals')

module.exports = tseslint.config(
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'node_modules/*',
      'src/data/db/migrations/*',
      // Agent scratch: a worktree checked out under .claude/ would otherwise be linted a second
      // time from the root, reporting every finding twice. jest and tsc exclude these too.
      '.claude/**',
      '.superpowers/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      'import/core-modules': ['@env'],
    },
    // A rule that stays at `warn` is neither enforced nor removed — it becomes ambient noise that
    // trains everyone (human and AI) to ignore the gate. So heuristic rules are `error`, and the
    // escape hatch for a genuine false positive or deliberate choice is a LOCAL, justified inline
    // `eslint-disable` (see AGENTS.md). `reportUnusedDisableDirectives` keeps those honest: a
    // disable that stops suppressing anything (e.g. the compiler fixes its false positive) errors.
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-explicit-any': 'error',
      'import/first': 'error',
      // React Compiler correctness rules. Enforced; the few genuine false positives (idiomatic
      // gesture/reanimated code) and deliberate exceptions carry inline justified disables.
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/purity': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/jest.setup.js', '**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    // In tests these rules stop earning their keep: `any` is the norm for mocks/partial fixtures,
    // and `import/first` fights the mock-before-import ordering tests legitimately need. Off here
    // (not `warn`) — a rule that isn't trustworthy in a context should be silent there, not noisy.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'import/first': 'off',
    },
  },
)
