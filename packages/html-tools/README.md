# @soeditor/html-tools

UI-independent HTML diagnostic providers, Problems aggregation, and explicit
guarded Prettier formatting for SoEditor. Formatting is command-driven and
refuses parser-invalid source; unknown elements and CMS markers are not
diagnostic errors merely because they are unfamiliar.

## Accessibility and SEO diagnostics

`AccessibilityDiagnosticsPlugin` and `SeoDiagnosticsPlugin` are independently
selectable plugins. Each automatically loads `DiagnosticsPlugin`, registers a
source-only provider, and contributes to the existing `document.validate`
command and `DiagnosticsService` result. They parse canonical HTML into
SoEditor-owned trees; they never render, execute, sanitize, fetch, or mutate the
source.

```ts
import {
    AccessibilityDiagnosticsPlugin,
    SeoDiagnosticsPlugin,
} from '@soeditor/html-tools';

const editor = await Editor.create({
    data: '<!doctype html><html><head></head><body></body></html>',
    plugins: [AccessibilityDiagnosticsPlugin, SeoDiagnosticsPlugin],
    config: {
        htmlTools: {
            accessibility: {
                rules: {
                    'a11y.heading-order': false,
                    'a11y.iframe-title': 'error',
                },
            },
            seo: {
                rules: {
                    'seo.h1': 'warning',
                },
            },
        },
    },
});

const problems = await editor.execute('document.validate');
```

A rule setting is either `false` or `error | warning | info | hint`. Unknown
rule codes and malformed values fail editor initialization with an actionable
configuration error.

| Provider             | Rule                    | Default | Scope                                                        |
| -------------------- | ----------------------- | ------- | ------------------------------------------------------------ |
| `html.accessibility` | `a11y.form-label`       | warning | Visible HTML form controls without a native/ARIA label path. |
| `html.accessibility` | `a11y.heading-order`    | warning | Heading-level jumps in complete documents only.              |
| `html.accessibility` | `a11y.iframe-title`     | warning | Iframes with a missing or empty `title`.                     |
| `html.accessibility` | `a11y.interactive-name` | warning | Buttons/button-like inputs without a detectable name.        |
| `html.seo`           | `seo.document-title`    | warning | Missing, empty, or duplicate complete-document title.        |
| `html.seo`           | `seo.h1`                | info    | Missing or multiple complete-document `h1` elements.         |
| `html.seo`           | `seo.meta-description`  | info    | Missing or empty complete-document meta description.         |

The base `html.structure` provider continues to report duplicate IDs, missing
image `alt`, and missing complete-document root `lang`. Template descendants
are treated as inert template data by the Phase 17 quality providers.

These rules are deliberately bounded source-analysis aids. They cannot inspect
computed styles, contrast, focus order, screen-reader behavior, rendered
scripts, application context, remote pages, search indexing, or ranking. Their
results are not a claim of WCAG, legal, Lighthouse, or search-engine
compliance.
