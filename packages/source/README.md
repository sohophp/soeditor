# @soeditor/source

CodeMirror 6 HTML Source editing for SoEditor. The surface preserves exact
canonical source, projects parser diagnostics, shares Core history, and exposes
only SoEditor-owned focus/search/range capabilities. CodeMirror types are not
part of the public package API.

Applications with a nonce-based `style-src` policy pass the request nonce as
`cspNonce` when creating the source engine. SoEditor forwards it to
CodeMirror's generated style element.
