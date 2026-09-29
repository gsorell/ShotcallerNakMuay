import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // `.flat.` matters. Up to eslint-plugin-react-hooks v5 the top-level
      // `configs["recommended-latest"]` WAS the flat config; from v6 that name
      // went back to being the legacy eslintrc shape (`plugins` as an array of
      // strings) and the flat ones moved under `configs.flat`. Passing the
      // legacy object to flat config does not lint anything badly — it makes
      // ESLint refuse to start at all, on every file.
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
