# Migrating from SoEditor 1.0 to 1.1

SoEditor `1.1.0` is an additive CMS Classic Editor release candidate. The
published registry reference remains `1.0.0` until an owner-authorized release.
Keep all directly installed `@soeditor/*` packages on one aligned version.

## Compatibility outcome

Stable 1.0 package-root APIs remain supported. The 1.1 candidate adds a lazy
`createClassicEditor()` entry and CMS-oriented plugin, UI, paste, upload, link,
object, table/list, localization, and save contracts. It does not replace the
framework-neutral Core, command/transaction path, Workspace, or existing
developer-oriented projections.

Experimental APIs remain outside the stable compatibility promise. Review the
generated API report and application tests before adopting newly exposed SDK
contracts.

## Package update

After 1.1 is authorized and published, update all direct SoEditor dependencies
together:

```json
{
    "dependencies": {
        "@soeditor/editor": "1.1.0",
        "@soeditor/plugin-sdk": "1.1.0",
        "@soeditor/workspace": "1.1.0"
    }
}
```

Do not mix 1.0 and 1.1 package artifacts in one installation. Until
publication, evaluate the candidate through repository builds or reviewed
tarballs rather than requesting `1.1.0` from npm.

## Adopting the Classic Editor

Existing `SoEditor.create()` and Workspace integrations require no migration.
Applications that want the CMS path can opt into `createClassicEditor()` and
provide a textarea or element host. Review configuration ownership for:

- native form submit/reset and explicit save/autosave;
- upload, asset, link, and internal-content picker services;
- allowed semantic styles, CMS objects, URLs, paste size, and upload limits;
- locale, direction, theme variables, plain-text icons, and content CSS;
- Source access, readonly policy, Preview isolation, and CSP;
- exact destruction when application routing replaces the editor.

The editor preserves unknown and unsafe source where required but does not
grant it execution permission. Backend authorization, durable storage,
revision conflict resolution, antivirus/media processing, plugin trust, and
operational monitoring remain host responsibilities.

## Plugin authors

Plugin tooling template version 3 adds `cms-widget`, `paste`, `upload`, and
`theme` families. Existing template-version-2 packages and 1.x SDK peer ranges
remain compatible. Re-run the package checker and packed consumer build; its
static warnings identify bounded source patterns and are not a malware or trust
verdict.

## Rollout checklist

1. Align all SoEditor package versions and run strict TypeScript and production
   bundling.
2. Exercise the complete author path: load, paste, upload, links, tables,
   Source, undo/redo, save/form submission, reset, and destroy.
3. Test real locale/IME, keyboard, zoom, forced-colors, CSP, and supported
   browser environments.
4. Validate server-side HTML policy, authorization, upload processing, save
   conflict handling, logging, and recovery.
5. Read the CMS configuration, saving, plugin ecosystem, security, deployment,
   troubleshooting, qualification, and support documents before rollout.

The 1.1 candidate does not add collaboration, track changes, arbitrary remote
plugin execution, a page builder, spreadsheet parity, or permission to execute
preserved unsafe HTML.
