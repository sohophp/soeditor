# Migrating a CMS integration from CKEditor 4

SoEditor targets the same broad CMS authoring problem but is an independent
editor. It does not implement CKEditor 4 APIs, configuration names, plugin
packages, data processors, skins, or global instance registries.

| CKEditor 4 concept         | SoEditor direction                                      |
| -------------------------- | ------------------------------------------------------- |
| `CKEDITOR.replace()`       | `await createClassicEditor(textarea, options)`          |
| `getData()` / `setData()`  | `classic.getData()` / `classic.setData()`               |
| `updateElement()`          | automatic textarea synchronization and native submit    |
| toolbar configuration      | toolbar item IDs invoking shared commands               |
| command execution          | `classic.editor.execute(commandId, ...args)`            |
| editor plugins             | typed plugins with explicit lifecycle/dependencies      |
| file browser/upload URL    | `FileManager` and `UploadService` adapters              |
| global `instances`         | retain each returned Classic handle explicitly          |
| `change` event             | `onChange` with canonical source and transaction origin |
| form save or Ajax callback | native submit or an explicit save adapter               |
| source mode                | the Source plugin backed by CodeMirror 6                |
| content CSS / skin         | content styles separated from UI variables              |

Migrate one integration boundary at a time:

1. Replace the textarea and verify native submit/reset plus exact custom HTML
   preservation.
2. Map toolbar actions to SoEditor command IDs; do not port direct DOM
   mutations.
3. Reimplement plugins against documented commands, transactions, services,
   UI contributions, and lifecycle APIs.
4. Wrap the existing asset picker and upload transport behind service
   adapters.
5. Choose native form submission, explicit manual saving, or opt-in debounced
   autosave. Pass server revision tokens through the save adapter.
6. Test paste fixtures, unsafe URLs, custom CMS markers, IME, mobile, readonly,
   failures, conflicts, and teardown in the host application.

Unknown HTML preservation does not grant execution permission. Keep backend
validation and output sanitization in place. CKEditor 4 plugins and skins
cannot be copied into SoEditor; replace private coupling with stable extension
points.
