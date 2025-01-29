import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-unresolved": "error",
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "none", ignoreRestSiblings: true },
      ],
      "no-undef": "error",
      eqeqeq: ["warn", "always"],

      "no-trailing-spaces": "off",
      semi: "off",
      quotes: "off",
      indent: "off",
    },
  },
];
