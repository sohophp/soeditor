const experimentalNames = new Set([
    'EditingBlock',
    'EditingBlockTag',
    'EditingInline',
    'EditingLinkMark',
    'EditingMark',
    'EditingModel',
    'EditingOpaqueBlock',
    'EditingOpaqueInline',
    'EditingOperation',
    'EditingParagraph',
    'EditingPoint',
    'EditingPointAffinity',
    'EditingResult',
    'EditingSelection',
    'EditingStructuredBlock',
    'EditingStructuredBlockContent',
    'EditingTextMark',
    'EditingTextRun',
    'MediaInsertOptions',
    'MediaPlugin',
    'MediaUpdateOptions',
    'StructuredBlockBehavior',
    'StructuredBlockConversion',
    'StructuredEditingContributionAlreadyRegisteredError',
    'StructuredEditingContributionConflictError',
    'StructuredEditingPlugin',
    'StructuredEditingRegistry',
    'StructuredEditingRegistrySealedError',
    'StructuredNodeViewActions',
    'StructuredNodeViewContext',
    'StructuredNodeViewFactory',
    'StructuredNodeViewInstance',
    'StructuredNodeViewSelectionOptions',
    'StructuredNodeViewState',
    'TableCellPosition',
    'TableCellRange',
    'TableInsertOptions',
    'TablePlugin',
    'VisualDecoration',
    'VisualDecorationsPlugin',
    'VisualDecorationsService',
    'VisualDecorationStatus',
    'mapEditingPoint',
    'readEditingOperations',
    'structuredEditingRegistryToken',
    'visualDecorationsServiceToken',
]);

const deprecatedNames = new Set();

export function classifyApiExport(name) {
    if (deprecatedNames.has(name)) return 'deprecated';
    if (experimentalNames.has(name)) return 'experimental';
    return 'stable';
}

export const apiClassifications = Object.freeze({
    deprecatedNames,
    experimentalNames,
});
