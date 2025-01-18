import importPlugin from 'eslint-plugin-import';

export default [
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
      'no-unused-vars': [
        'warn',
        { vars: 'all', args: 'none', ignoreRestSiblings: true },
      ],
      'no-undef': 'error',
      eqeqeq: ['warn', 'always'],

      'no-trailing-spaces': 'off',
      semi: 'off',
      quotes: 'off',
      indent: 'off',
    },
  },
];
