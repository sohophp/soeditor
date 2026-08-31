# @soeditor/wysiwyg

CMS-oriented WYSIWYG projection for SoEditor. It is intentionally separate
from the developer-oriented `visual` projection and writes through the same
canonical editor transactions.

The package owns an independent native-DOM editing engine; it does not reuse
Developer Visual's controlled model or structured node views. Safe standard
HTML is rendered as the corresponding element in one contenteditable subtree,
so table cells use ordinary browser caret and selection behavior, images render
as images, and elements such as `aside` retain their HTML semantics.

Commands restore the exact saved browser range, mutate the authoring surface,
and commit the serialized result through Core transactions. Preserved comments,
custom elements, scripts, unsafe attributes, and unsafe embeds remain available
in canonical Source as inert data without executing or displaying developer-only
labels and `Edit HTML` actions in WYSIWYG.
