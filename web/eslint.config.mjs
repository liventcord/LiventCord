import importPlugin from "eslint-plugin-import";
import globals from "globals";
import typescriptParser from "@typescript-eslint/parser";

import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import securityPlugin from "eslint-plugin-security";
import noUnsanitized from "eslint-plugin-no-unsanitized";

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
      "@typescript-eslint": typescriptPlugin,
      security: securityPlugin,
      "no-unsanitized": noUnsanitized
    },
    files: ["**/*.ts"],
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
      "@typescript-eslint/no-explicit-any": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "warn",
      "no-unsanitized/method": "warn",
      "no-unsanitized/property": "warn"
    }
  }
];
