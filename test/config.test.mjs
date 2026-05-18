import assert from 'node:assert/strict';
import test from 'node:test';

import { ESLint } from 'eslint';

import {
  autoConfig,
  cssConfig,
  etaConfig,
  htmlConfig,
  typescriptConfig,
  vueConfig,
} from '../eslint.config.mjs';

// Lint a snippet through a given config and return the triggered rule IDs.
const rulesFor = async (overrideConfig, code, filePath) => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig });
  const [result] = await eslint.lintText(code, { filePath });

  return result.messages.map((message) => message.ruleId);
};

test('every config is exported as a non-empty array', () => {
  const configs = [autoConfig, typescriptConfig, vueConfig, htmlConfig, cssConfig, etaConfig];

  configs.forEach((config) => {
    assert.ok(Array.isArray(config));
    assert.ok(config.length > 0);
  });
});

test('typescriptConfig flags var, missing semicolon and console in .js', async () => {
  const rules = await rulesFor(typescriptConfig, 'var x = 1\nconsole.log(x)\n', 'sample.js');

  assert.ok(rules.includes('no-var'));
  assert.ok(rules.includes('@stylistic/semi'));
  assert.ok(rules.includes('no-console'));
});

test('cssConfig flags empty blocks', async () => {
  const rules = await rulesFor(cssConfig, '.empty {}\n', 'sample.css');

  assert.ok(rules.includes('css/no-empty-blocks'));
});

test('cssConfig does not flag Tailwind at-rules', async () => {
  const rules = await rulesFor(cssConfig, '.tw {\n  @apply flex;\n}\n', 'sample.css');

  assert.ok(!rules.includes('css/no-invalid-at-rules'));
});

test('htmlConfig flags a missing img alt attribute', async () => {
  const rules = await rulesFor(htmlConfig, '<img src="x.png">\n', 'sample.html');

  assert.ok(rules.includes('@html-eslint/require-img-alt'));
});

test('etaConfig flags var and missing semicolon inside exec tags', async () => {
  const rules = await rulesFor(etaConfig, '<% var n = 1 %>\n', 'sample.eta');

  assert.ok(rules.includes('no-var'));
  assert.ok(rules.includes('@stylistic/semi'));
});

test('autoConfig lints js, css, html and eta from a single config', async () => {
  const jsRules = await rulesFor(autoConfig, 'var x = 1\n', 'sample.js');
  const cssRules = await rulesFor(autoConfig, '.empty {}\n', 'sample.css');
  const htmlRules = await rulesFor(autoConfig, '<img src="x.png">\n', 'sample.html');
  const etaRules = await rulesFor(autoConfig, '<% var n = 1 %>\n', 'sample.eta');

  assert.ok(jsRules.includes('no-var'));
  assert.ok(cssRules.includes('css/no-empty-blocks'));
  assert.ok(htmlRules.includes('@html-eslint/require-img-alt'));
  assert.ok(etaRules.includes('no-var'));
});
