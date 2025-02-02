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
      "no-trailing-spaces": "warn",
      semi: ["error", "always"],
      quotes: "warn",
      curly: "off",
      "consistent-return": "error",
      "prefer-const": "error",
      "no-use-before-define": ["error", { functions: false, classes: false }],
      "object-shorthand": ["error", "always"],
      "array-callback-return": "error",
      "no-shadow": "warn",
      "space-infix-ops": ["error", { "int32Hint": false }],
      "no-duplicate-imports": "error",
      "import/order": [
        "error",
        { groups: [["builtin", "external", "internal"]] },
      ],
    },
  },
];
