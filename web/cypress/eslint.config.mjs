import importPlugin from "eslint-plugin-import"
import globals from "globals"
import typescriptParser from "@typescript-eslint/parser"
import typescriptPlugin from "@typescript-eslint/eslint-plugin"

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
    files: ["e2e/*"],
    rules: {
      "import/no-unresolved": "off",
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "none", ignoreRestSiblings: true }
      ],
      "no-undef": "warn",
      eqeqeq: ["warn", "always"],
      "no-trailing-spaces": "warn",
      quotes: "off",
      curly: "off",
      "consistent-return": "off",
      "prefer-const": "warn",
      "no-use-before-define": "off",
      "object-shorthand": ["warn", "always"],
      "array-callback-return": "error",
      "no-shadow": "warn",
      "space-infix-ops": ["warn", { int32Hint: false }],
      "no-duplicate-imports": "warn",
      "import/order": [
        "error",
        { groups: [["builtin", "external", "internal"]] }
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { vars: "all", args: "none", ignoreRestSiblings: true }
      ],
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["cypress/**/*.cy.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        ...globals.mocha,
        Cypress: true,
        cy: true
      }
    },
    rules: {
      "no-undef": "off"
    }
  }
]
