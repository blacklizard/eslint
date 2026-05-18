# @blacklizard/eslint-blacklizard

Reusable, opinionated ESLint config — Blacklizard code standards. Built on
[`eslint-config-airbnb-extended`](https://www.npmjs.com/package/eslint-config-airbnb-extended),
flat config, ESLint 9+.

## Install

```sh
pnpm add -D eslint @blacklizard/eslint-blacklizard
```

`eslint` is a peer dependency (`>=9`). Requires Node `>=24`.

## Usage

The default export auto-configures itself — every rule set is scoped by file
extension, so `.js`/`.ts`, `.vue`, `.html`, `.css` and `.eta` files each get
the right rules with no manual selection:

```js
// eslint.config.mjs — lints everything
export { default } from '@blacklizard/eslint-blacklizard';
```

That is all most projects need. The individual configs are also exported if
you want to lint only one file type:

```js
export { typescriptConfig as default } from '@blacklizard/eslint-blacklizard';
export { vueConfig as default } from '@blacklizard/eslint-blacklizard';
export { htmlConfig as default } from '@blacklizard/eslint-blacklizard';
export { cssConfig as default } from '@blacklizard/eslint-blacklizard';
export { etaConfig as default } from '@blacklizard/eslint-blacklizard';
```

To extend a config with project-specific rules:

```js
import config from '@blacklizard/eslint-blacklizard';

export default [
  ...config,
  {
    rules: {
      // project overrides
    },
  },
];
```

## Exports

| Export             | Files            | Covers                                                       |
| ------------------ | ---------------- | ------------------------------------------------------------ |
| `autoConfig`       | all of the below | every config combined, scoped by file extension              |
| `typescriptConfig` | `.js`, `.ts`     | airbnb base + node + typescript; Tailwind classes in JSX/TSX  |
| `vueConfig`        | + `.vue`         | above, widened to SFCs + `eslint-plugin-vue` + Tailwind       |
| `htmlConfig`       | `.html`          | `@html-eslint` recommended markup rules                      |
| `etaConfig`        | `.eta`           | JS inside `<% %>` exec tags of Eta templates                 |
| `cssConfig`        | `.css`           | `@eslint/css` recommended rules                              |

`default` is `autoConfig`.

## Notable rule choices

- `@stylistic/max-len`: 120 (comments + URLs exempt)
- `@stylistic/semi`: always
- `max-depth`: 2
- `@stylistic/padding-line-between-statements`: blank lines after imports,
  before `return`, around blocks and functions
- `no-console`: error (allows `console.warn` / `console.error`)
- Relaxed rules for `*.{test,spec}.*` and `__tests__/`

## Tailwind CSS

`typescriptConfig` and `vueConfig` lint Tailwind class attributes via
[`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss)
(`recommended` rules — class order, duplicates, conflicts, unknown classes).

Class-resolution rules need to know your Tailwind setup, so consumers **must**
add a `settings` block pointing at it:

```js
import { vueConfig } from '@blacklizard/eslint-blacklizard';

export default [
  ...vueConfig,
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/styles/app.css', // Tailwind v4: your CSS entry
        // tailwindConfig: 'tailwind.config.js', // Tailwind v3 instead
      },
    },
  },
];
```

`tailwindcss` (`^3.3.0 || ^4.1.17`) must be installed in the project.

## Requirements & caveats

- **Typed linting** (`typescriptConfig`, `vueConfig`) needs a `tsconfig.json`
  covering the linted files — including `.vue` for Vue projects. Without it,
  ESLint reports `"not found by the project service"`.
- **Tailwind**: without the `settings['better-tailwindcss']` block above,
  class-resolution rules cannot work and will flag every class as unknown.
- **HTML**: inline `<script>` JS is not linted — keep scripts in external
  `.js` files.
- **Eta**: only JS in `<% %>` exec tags is linted. Interpolation tags
  (`<%= %>`, `<%~ %>`) and HTML markup are not checked.
- **CSS**: `css/no-invalid-at-rules` is disabled — Tailwind at-rules
  (`@apply`, `@theme`, `@utility`, `@variant`) are not standard CSS and would
  otherwise false-flag every Tailwind file. All other `@eslint/css` rules
  (empty blocks, duplicate imports/keyframes, `!important`, baseline, etc.)
  stay on.

## Releasing

Versioning is managed with [changesets](https://github.com/changesets/changesets):

```sh
pnpm changeset   # 1. record a change + pick bump type (patch/minor/major)
pnpm version     # 2. apply bumps, write CHANGELOG.md     (changeset version)
git commit -am "version packages"   # 3. commit the bump
pnpm release     # 4. lint + test, then tag + push
```

Pushing the `v*` tag triggers the GitHub Actions workflow, which publishes to
npm with provenance.

## License

MIT
# eslint
