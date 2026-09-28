// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Seed and integration-script tooling still carries `any` and dead locals; tracked as tech debt.
    // Plain .js harnesses aren't type-checked, so no-undef is meaningless there.
    files: ['prisma/**/*.ts', 'scripts/**/*.ts', 'scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-useless-assignment': 'warn',
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
