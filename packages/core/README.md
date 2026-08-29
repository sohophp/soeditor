# @soeditor/core

Framework-independent editor lifecycle, state, transactions, commands, plugins,
events, services, and configuration for SoEditor.

This early package contains infrastructure only. It has no DOM or editing UI.
Applications may update the general editing policy with `setReadonly()`;
attached feature surfaces are responsible for observing the immutable state
transition.
