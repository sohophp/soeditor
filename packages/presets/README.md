# @soeditor/presets

Immutable plugin and toolbar definitions for minimal, classic, CMS, developer,
and Markdown SoEditor configurations. The experimental CMS preset is the
author-focused default used by `createClassicEditor`; it keeps Source without
eagerly selecting Preview, diagnostics, or document formatting. The Developer preset includes quality
diagnostics and projection/split infrastructure, but presets never create
editors, engines, layouts, or DOM surfaces and do not hide Preview or
FileManager application configuration.

Classic and CMS presets include the command-backed text color, background
color, and font-size controls. The same controls operate in WYSIWYG and
Developer Visual projections; Source retains direct HTML editing semantics.
