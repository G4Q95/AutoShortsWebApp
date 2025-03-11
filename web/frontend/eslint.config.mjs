import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/public/**",
      "**/out/**",
      "**/build/**",
      "**/dist/**",
      "test.js",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
