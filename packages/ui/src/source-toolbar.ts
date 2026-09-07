// The WYSIWYG-only global rejects Source; keep its unreachable controls out
// of that artifact while preserving the complete ESM/compatibility registry.
export const SOURCE_TOOLBAR =
    (
        import.meta as ImportMeta & {
            readonly env: Readonly<Record<string, string | undefined>>;
        }
    ).env.SOEDITOR_SOURCE_TOOLBAR !== 'false';
