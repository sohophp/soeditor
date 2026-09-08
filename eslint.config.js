import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/coverage/**',
            '**/.wrangler/**',
            'docs/site/public/demos/**',
            'docs/site/.vitepress/cache/**',
            'docs/site/.vitepress/.temp/**',
            'docs/site/.vitepress/reports/**',
            '**/dist/**',
            '**/node_modules/**',
            '**/playwright-report/**',
            '**/test-results/**',
        ],
    },
    {
        files: ['docs/site/scripts/*.mjs'],
        languageOptions: {
            globals: {
                fetch: 'readonly',
                AbortSignal: 'readonly',
                URL: 'readonly',
                setTimeout: 'readonly',
            },
        },
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
        },
    },
);
