# ADR 0023 — Application-Attached Accessible Split Layout

## Status

Accepted for Phase 20.

## Context

Phase 19 separates projection visibility and write authority from Core mode,
but it deliberately owns no DOM. A split workflow now needs pane structure,
labels, resizing, focus, collapse, and responsive behavior. Putting that state
in Core would introduce browser presentation concerns. Putting it inside any
surface engine would make other projections depend on private DOM and would
hide application ownership of engine construction and Preview security.

The layout must coordinate existing caller-owned hosts while canonical source
and primary write authority remain under Core and `@soeditor/projections`.

## Decision

Create browser-facing, framework-independent `@soeditor/layout` with two
layers:

- `SplitViewPlugin` owns validated immutable layout state, public commands, and
  a per-editor service;
- `createSplitViewLayout()` is an exclusive DOM adapter that receives an empty
  layout root plus explicit caller-owned projection hosts.

The supported graph is intentionally finite: `Visual | Source`,
`Source | Preview`, and `Markdown | Preview`. The plugin uses only public
projection commands to show members or transfer authority. It never creates
surface engines, changes canonical source, configures Preview, or accesses
CodeMirror.

The DOM adapter renders two named regions and one accessible separator. It
tracks requested orientation separately from effective orientation so narrow
responsive fallback is reversible. Ratios are bounded and exposed through ARIA;
pointer and keyboard paths execute the same layout commands. Collapse hides a
pane without detaching its engine, and restoration returns it to the current
ratio.

Caller ownership is preserved with exact DOM anchors and attribute snapshots.
Destruction removes layout-owned nodes/listeners/observers, restores supplied
hosts to their original positions, and leaves engines and editor lifecycle to
their owners.

## Consequences

- Core and projection coordination remain DOM-free.
- Hosts and Preview security configuration remain explicit application inputs.
- Third-party UI can invoke the same stable commands without knowing layout
  internals.
- Phase 21 can curate the layout contract and presets without making mounting
  implicit.
- Arbitrary docking, persistence, more than two panes, and framework adapters
  remain deferred.
