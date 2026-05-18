import { existsSync } from 'node:fs';
import path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import cssPlugin from '@eslint/css';
import js from '@eslint/js';
import htmlPlugin from '@html-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import { configs, plugins, rules } from 'eslint-config-airbnb-extended';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import pluginVue from 'eslint-plugin-vue';

const gitignorePath = path.resolve('.', '.gitignore');
// eslint-disable-next-line n/no-sync -- config loads synchronously at startup
const gitignoreConfig = existsSync(gitignorePath)
  ? [includeIgnoreFile(gitignorePath)]
  : [];

const VUE_GLOB = '**/*.vue';
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const TS_VUE_FILES = [...TS_FILES, VUE_GLOB];
// Every file type that carries JS/TS rules — used to scope shared overrides
// so their @stylistic rules never reach .css/.html/.eta files.
const SCRIPT_FILES = [
  '**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx',
  '**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx',
  VUE_GLOB,
];

const isJsOnly = (entry) => Array.isArray(entry.files)
  && entry.files.every((glob) => /\.(?:c|m)?jsx?$/.test(glob));

// Widen an airbnb flat-config entry so its rules also cover .vue SFCs.
// Entries that intentionally target plain JS are left untouched.
const includeVue = (entry) => {
  if (!Array.isArray(entry.files) || isJsOnly(entry) || entry.files.includes(VUE_GLOB)) {
    return entry;
  }

  return { ...entry, files: [...entry.files, VUE_GLOB] };
};

// Restrict TypeScript parsing + typed rules to the given globs, so the
// typescript-eslint parser never leaks onto plain .js/.mjs/.cjs files.
const scopeTs = (files) => (entry) => (isJsOnly(entry) ? entry : { ...entry, files });

// Give an unscoped entry a script-file scope, so its JS rules never reach
// .css/.html/.eta files when configs are combined in autoConfig.
const ensureScriptScope = (entry) => (Array.isArray(entry.files) ? entry : { ...entry, files: SCRIPT_FILES });

// Give an unscoped entry a .vue scope, so vue rules never reach other files.
const ensureVueScope = (entry) => (Array.isArray(entry.files) ? entry : { ...entry, files: [VUE_GLOB] });

// Extract the JavaScript from Eta exec tags (<% ... %>) while masking every
// other character with whitespace, so reported line/column numbers still
// point at the original .eta file. Interpolation (<%=), raw (<%~) and comment
// (<%#) tags are skipped — they hold expressions, not statements.
const ETA_TAG = /<%([\s\S]*?)%>/g;

// Code offset of an exec tag's inner JS, skipping a leading slurp char (_ or -).
const etaCodeStart = (match, inner) => match.index + 2 + (/^[_-]/.test(inner) ? 1 : 0);

// End offset of an exec tag's inner JS, skipping a trailing slurp char.
const etaCodeEnd = (match, inner) => match.index + 2 + inner.length - (/[_-]$/.test(inner) ? 1 : 0);

// Blank out a chunk, keeping newlines so line numbers are preserved.
const maskChunk = (chunk) => chunk.replace(/[^\n]/g, ' ');

const extractEtaScript = (text) => {
  let out = '';
  let cursor = 0;
  let match = ETA_TAG.exec(text);

  while (match !== null) {
    const inner = match[1];
    const isExecTag = !/^[=~#]/.test(inner);
    const tagEnd = match.index + match[0].length;
    const codeStart = isExecTag ? etaCodeStart(match, inner) : tagEnd;
    const codeEnd = isExecTag ? etaCodeEnd(match, inner) : tagEnd;

    out += maskChunk(text.slice(cursor, codeStart))
      + text.slice(codeStart, codeEnd)
      + maskChunk(text.slice(codeEnd, tagEnd));
    cursor = tagEnd;
    match = ETA_TAG.exec(text);
  }

  return out + maskChunk(text.slice(cursor));
};

// Processor that lets ESLint lint the JS inside .eta templates.
const etaProcessor = {
  meta: { name: 'blacklizard/eta', version: '1.0.0' },
  preprocess: (text) => [{ text: extractEtaScript(text), filename: 'script.js' }],
  postprocess: (messageLists) => messageLists.flat(),
  supportsAutofix: false,
};

const baseEntries = [
  // ESLint recommended config
  {
    name: 'js/config',
    ...js.configs.recommended,
  },
  // Stylistic plugin
  plugins.stylistic,
  // Import X plugin
  plugins.importX,
  // Airbnb base recommended config
  ...configs.base.recommended,
  // Strict import rules
  rules.base.importsStrict,
];

const nodeEntries = [
  // Node plugin
  plugins.node,
  // Airbnb Node recommended config
  ...configs.node.recommended,
];

const typescriptEntries = [
  // TypeScript ESLint plugin
  plugins.typescriptEslint,
  // Airbnb base TypeScript config
  ...configs.base.typescript,
  // Strict TypeScript rules
  rules.typescript.typescriptEslintStrict,
  // Enable typed linting
  {
    name: 'blacklizard/typescript-project-service',
    languageOptions: {
      parserOptions: { projectService: true },
    },
  },
];

const vueEntries = [
  // eslint-plugin-vue flat recommended config
  ...pluginVue.configs['flat/recommended'],
  // TypeScript support inside <script lang="ts"> blocks
  {
    name: 'blacklizard/vue-typescript',
    files: [VUE_GLOB],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        projectService: true,
        extraFileExtensions: ['.vue'],
      },
    },
  },
];

// Tailwind class-attribute linting (eslint-plugin-better-tailwindcss).
// Consumers must set settings['better-tailwindcss'].entryPoint (Tailwind v4)
// or .tailwindConfig (v3) so class-resolution rules work.
const tailwindEntry = (files) => ({
  ...betterTailwind.configs.recommended,
  name: 'blacklizard/tailwind',
  files,
});

const stylisticOverrides = {
  name: 'blacklizard/stylistic-overrides',
  files: SCRIPT_FILES,
  rules: {
    '@stylistic/lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true },
    ],
  },
};

const blacklizardOverrides = {
  name: 'blacklizard/overrides',
  files: SCRIPT_FILES,
  rules: {
    curly: ['error', 'all'],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'max-depth': ['error', 2],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/padding-line-between-statements': [
      'error',
      // Blank line after the import block
      { blankLine: 'always', prev: 'import', next: '*' },
      { blankLine: 'any', prev: 'import', next: 'import' },
      // Blank line before return
      { blankLine: 'always', prev: '*', next: 'return' },
      // Blank line around block-like statements (if/for/while/switch/try)
      { blankLine: 'always', prev: 'block-like', next: '*' },
      { blankLine: 'always', prev: '*', next: 'block-like' },
      // Blank line around function declarations
      { blankLine: 'always', prev: 'function', next: '*' },
      { blankLine: 'always', prev: '*', next: 'function' },
    ],
    '@stylistic/max-len': [
      'error',
      {
        code: 120,
        tabWidth: 2,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
  },
};

// Global ignores — applied regardless of .gitignore presence.
const ignores = {
  name: 'blacklizard/ignores',
  ignores: ['**/dist/**', '**/build/**', '**/coverage/**'],
};

// CSS linting via @eslint/css.
const cssEntry = {
  ...cssPlugin.configs.recommended,
  name: 'blacklizard/css',
  files: ['**/*.css'],
  language: 'css/css',
  languageOptions: { tolerant: true },
  rules: {
    ...cssPlugin.configs.recommended.rules,
    // Tailwind at-rules (@apply, @theme, @utility, @variant, @tailwind) are
    // not standard CSS — disable so they don't false-flag every Tailwind file.
    'css/no-invalid-at-rules': 'off',
  },
};

// HTML markup linting via @html-eslint.
const htmlEntry = {
  ...htmlPlugin.configs['flat/recommended'],
  name: 'blacklizard/html',
  files: ['**/*.html'],
  language: '@html-eslint/html',
};

// Relaxed rules for test files.
const testOverrides = {
  name: 'blacklizard/test-overrides',
  files: [
    '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
    '**/__tests__/**',
  ],
  rules: {
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    '@stylistic/max-len': 'off',
    // Test files import relative ESM modules — Node requires the extension.
    'import-x/extensions': 'off',
    'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
  },
};

// TypeScript config: base + node + typescript rules for .js/.ts files.
export const typescriptConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  ...baseEntries,
  ...nodeEntries,
  ...typescriptEntries.map(scopeTs(TS_FILES)),
  // Tailwind class linting for JSX/TSX
  tailwindEntry(['**/*.jsx', '**/*.tsx']),
  stylisticOverrides,
  blacklizardOverrides,
  testOverrides,
]);

// Vue config: everything in the TypeScript config, widened to .vue SFCs,
// plus eslint-plugin-vue recommended rules.
export const vueConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  ...baseEntries.map(includeVue),
  ...nodeEntries.map(includeVue),
  ...typescriptEntries.map(scopeTs(TS_VUE_FILES)),
  ...vueEntries,
  // Tailwind class linting for .vue SFCs and JSX/TSX
  tailwindEntry([VUE_GLOB, '**/*.jsx', '**/*.tsx']),
  stylisticOverrides,
  blacklizardOverrides,
  testOverrides,
]);

// HTML config: @html-eslint recommended markup rules for .html files.
export const htmlConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  htmlEntry,
]);

// CSS config: @eslint/css recommended rules for .css files.
export const cssConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  cssEntry,
]);

// Attach the Eta processor to .eta files — extracts the JS from exec tags.
const etaProcessorEntry = {
  name: 'blacklizard/eta-processor',
  files: ['**/*.eta'],
  processor: etaProcessor,
};

// Lint the extracted JS blocks (virtual path: <file>.eta/<n>_script.js).
const etaRulesEntry = {
  name: 'blacklizard/eta',
  files: ['**/*.eta/*.js'],
  plugins: { '@stylistic': plugins.stylistic.plugins['@stylistic'] },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    // Off — template variables (it, layout data) are injected at render time.
    'no-undef': 'off',
    'no-unused-vars': 'off',
    'no-unused-expressions': 'off',
    strict: 'off',
    // Off — the extractor masks non-JS regions with whitespace to preserve
    // line numbers, which would otherwise trip every layout rule.
    '@stylistic/indent': 'off',
    '@stylistic/no-trailing-spaces': 'off',
    '@stylistic/no-multiple-empty-lines': 'off',
    '@stylistic/eol-last': 'off',
    '@stylistic/max-len': 'off',
    '@stylistic/padding-line-between-statements': 'off',
    '@stylistic/lines-around-comment': 'off',
    // Style — kept in sync with the rest of the config.
    eqeqeq: ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],
  },
};

// Eta config: lints the JS inside <% %> exec tags of .eta templates.
// Scope-dependent rules are off — template data is injected at render time.
export const etaConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  etaProcessorEntry,
  etaRulesEntry,
]);

// Auto config: all of the above in one. Every entry is scoped by file
// extension, so ESLint applies the right rules per file with no manual
// selection — .ts/.js, .vue, .html, .css and .eta all just work.
export const autoConfig = defineConfig([
  ignores,
  // Ignore files and folders listed in .gitignore when present
  ...gitignoreConfig,
  ...baseEntries.map(includeVue).map(ensureScriptScope),
  ...nodeEntries.map(includeVue).map(ensureScriptScope),
  ...typescriptEntries.map(scopeTs(TS_VUE_FILES)),
  ...vueEntries.map(ensureVueScope),
  // Tailwind class linting for .vue SFCs and JSX/TSX
  tailwindEntry([VUE_GLOB, '**/*.jsx', '**/*.tsx']),
  htmlEntry,
  cssEntry,
  etaProcessorEntry,
  etaRulesEntry,
  stylisticOverrides,
  blacklizardOverrides,
  testOverrides,
]);

export default autoConfig;
