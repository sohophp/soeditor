---
title: 'Configuration'
description: 'Configure the published CMS editor using typed options for content, layout, language, Source and saving.'
---

# Configuration

`CreateClassicEditorOptions` is the readonly creation configuration. These are common CMS fields; installed declarations remain the complete type reference.

| Field                             | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| locale / translations             | Locale and host translations             |
| data                              | Initial HTML                             |
| readonly                          | Initial readonly state                   |
| minHeight / maxHeight             | Editing area height constraints          |
| toolbar / toolbarLayout           | Toolbar items and layout                 |
| editingModes / initialEditingMode | Modes for the optional entry             |
| source                            | Source enhancements                      |
| save                              | Host save adapter for the optional entry |
| onChange / onError                | Change and error callbacks               |

The default entry rejects options that require optional runtimes. Use the correct entry rather than bypassing the error with a type assertion.

## Checked code

<<< ../../examples/api.ts#configuration

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
