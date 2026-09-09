# Default Classic video controls

Accepted on 2026-09-09 by explicit owner request for the 1.4.0 release.

Classic editors include the focused CMS video plugin and toolbar item by default. Explicit toolbars remain authoritative. `video: false` disables automatic installation; an explicitly supplied video plugin keeps its existing behavior.

The authoring surface uses inert cards. Dialogs and players load on first use, and default YouTube metadata lookup is disabled. This decision does not authorize arbitrary executable embeds.

The global distribution loads image context tools and video dialogs from companion JavaScript files. Self-hosting must preserve the complete distribution directory. Published package imports and versioned CDN paths remain the documented integration methods.

## Measured startup tradeoff

The packed multi-entry Vite consumer grows from 494,969 / 149,535 bytes to 505,304 / 152,796 bytes (raw / combined gzip), approximately 2.1% / 2.2%. This is the synchronous video command, inert-card, clipboard and URL-policy support required for existing video HTML and a working default toolbar. Dialogs, playback and metadata stay outside startup. The ESM guard is deliberately adjusted to 510,000 / 155,000 bytes for this approved CMS workflow; unrelated UI refactoring is avoided.

The global build retains its original 500,000 / 150,000 byte limits by moving image tools and video runtime behind first-use companion assets. No interaction latency budget is increased.

The optional-entry browser measurement changes from 511,218 / 151,884 to 521,888 / 155,379 bytes, approximately 2.1% / 2.3%. Its initial guard becomes 525,000 / 157,000 bytes; Source, formatting, recovery and latency guards are unchanged. The optional entry may load the explicit `@soeditor/preview/media` service-token leaf (no DOM, player, fetch or preview implementation). All other preview runtime modules remain excluded from startup.
