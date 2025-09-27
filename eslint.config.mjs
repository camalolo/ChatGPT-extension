// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import unicorn from "eslint-plugin-unicorn";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  unicorn.configs.recommended,
  security.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      // Sonar-like extras
      "unicorn/no-array-for-each": "warn",
      "unicorn/no-for-loop": "warn",
      "unicorn/prefer-query-selector": "warn",
      "unicorn/no-null": "warn",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-non-literal-fs-filename": "warn",
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "script" },
  },
];
