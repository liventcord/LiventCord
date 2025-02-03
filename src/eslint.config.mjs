import importPlugin from "eslint-plugin-import";
import globals from "globals";
import typescriptParser from "@typescript-eslint/parser";

import typescriptPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.eslint.json"
      },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    plugins: {
      import: importPlugin,
      "@typescript-eslint": typescriptPlugin
    },
    files: ["**/*.ts"],
    rules: {
      "import/no-unresolved": "error",
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "none", ignoreRestSiblings: true }
      ],
      "no-undef": "error",
      eqeqeq: ["warn", "always"],
      "no-trailing-spaces": "warn",
      quotes: "off",
      curly: "off",
      "consistent-return": "error",
      "prefer-const": "error",
      "no-use-before-define": "off",
      "object-shorthand": ["error", "always"],
      "array-callback-return": "error",
      "no-shadow": "warn",
      "space-infix-ops": ["error", { int32Hint: false }],
      "no-duplicate-imports": "error",
      "import/order": [
        "error",
        { groups: [["builtin", "external", "internal"]] }
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { vars: "all", args: "none", ignoreRestSiblings: true }
      ],
      "@typescript-eslint/no-explicit-any": "off"
    },
    ignores: ["assets/ts/audio.d.ts"]
  }
];
