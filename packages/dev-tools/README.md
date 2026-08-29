# @soeditor/dev-tools

HTML Problems, element path, inspector, document outline, command palette,
Find/Replace, and source navigation for SoEditor.

The package consumes public SoEditor services and keeps HTML analysis separate
from generic Core and UI infrastructure.

The Problems panel observes the diagnostics workflow, announces loading and
stable counts, groups Problems by provider, exposes provider/severity checkbox
filters, and reports isolated provider errors. Source-backed Problems are
buttons that invoke the shared reveal command; Up/Down arrows move between
those buttons. Problems without a source range remain readable text rather
than disabled controls.
