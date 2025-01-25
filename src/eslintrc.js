module.exports = {
  env: {
    browser: true,
    es2020: true,
  },
  globals: {
    window: "readonly",
    document: "readonly",
    console: "readonly",
    navigator: "readonly",
  },
  plugins: ["import"],
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
};
