# Security model and threat review

SoEditor treats canonical content, rendered projections, executable behavior,
plugins, and host services as different trust domains. HTML-first preservation
never means that preserved source may execute inside the editor.

## Assets and trust boundaries

| Asset or input                | Trust assumption                      | SoEditor boundary                                                 |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Canonical HTML/Markdown       | Untrusted content                     | Stored as source; mutations use transactions                      |
| Visual projection             | Untrusted source, controlled renderer | Supported nodes are constructed; unknown/unsafe nodes are inert   |
| Preview document              | Untrusted content and template values | Empty-sandbox `srcdoc` iframe plus fixed CSP and filtering        |
| Plugin package                | Trusted application code              | Installed and executed with application privileges; not sandboxed |
| FileManager result            | Untrusted service result              | Typed validation and safe URL policy before command insertion     |
| Clipboard/drop data           | Untrusted browser input               | Parsed, normalized, rejected, or inserted through transactions    |
| Comment/revision storage      | Untrusted asynchronous host boundary  | Immutable validation, observable failures, host authorization     |
| Framework props and DOM hosts | Application-owned                     | Explicit Workspace lifecycle and reverse cleanup                  |
| npm artifacts                 | Supply-chain input                    | Frozen install, audit, pack consumers, provenance metadata        |

## Preserved content

Unknown elements, comments, CMS markers, meaningful attributes, and unsupported
structures remain canonical source where practical. Visual rendering does not
insert raw preserved markup. Scripts, event-handler attributes, unsafe links,
iframes, embeds, and other executable source are displayed inertly or omitted
from the live projection without being silently deleted from canonical source.

Source mode exposes exact content to the user but does not execute it. A host
that later renders saved content on a public site must apply its own server-side
validation, sanitization, authorization, and output policy. Editor safety is
not a replacement for publishing safety.

## Preview

Preview uses a sandboxed iframe with an empty `sandbox` attribute, so it has no
script, same-origin, form, popup, navigation, or plugin permission. The rendered
document receives a fixed policy including `default-src 'none'`,
`script-src 'none'`, and a bounded style policy. Source-controlled CSP, refresh,
base, scripts, handlers, unsafe embeds, and URLs cannot weaken this boundary.

Applications must not add `allow-scripts` or `allow-same-origin` to the editor
Preview iframe. A CMS that needs executable site behavior should use a separate,
trusted preview deployment with its own origin, authentication, CSP, and data
contract.

## Plugins and tooling

SoEditor plugins are ordinary application dependencies. They can execute code
with the same privileges as the application and must be reviewed, pinned, and
tested accordingly. There is no remote plugin loader or hosted marketplace.

`@soeditor/plugin-tools` performs bounded static package-shape checks and uses
script-disabled packing. It is not a malware scanner, signature authority,
sandbox, or trust verdict. Never inspect an untrusted package by installing it
with lifecycle scripts enabled.

## Host-owned services and review data

The host owns authentication, authorization, tenant isolation, CSRF protection,
rate limiting, durable storage, audit logs, retention, backups, erasure, and
conflict handling. Client permission callbacks improve UI consistency but are
not a backend security boundary. Re-check every write, export, and erasure on
the server.

Workspace recovery retains the latest canonical source in memory and recreates
application-owned attachments. It is not durable persistence and must not be
used as the only save mechanism.

## Browser application CSP

SoEditor ESM and CSS can be self-hosted under a strict application policy.
CodeMirror creates style elements at runtime; pass the request nonce through
`cspNonce` to `createSourceEditingEngine()` and
`createMarkdownEditingEngine()`. See
[`deployment-operations.md`](deployment-operations.md) for a deployment
template. The nonce is application-generated per response; never hard-code or
reuse it as a secret.

## Threat review summary

The release gate covers inert unsafe source, clipboard/drop boundaries,
Preview isolation, text-only UI messages, unsafe FileManager output, CMS marker
preservation, package metadata, dependency audit, and lifecycle cleanup.

Residual risks remain host- and environment-dependent: backend rendering,
third-party plugins, compromised dependencies, misconfigured CSP, executable
external preview applications, storage authorization, browser vulnerabilities,
and denial of service from documents beyond qualified bounds. Report suspected
vulnerabilities privately as described in
[`support-policy.md`](support-policy.md).
