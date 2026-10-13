// Legacy table services return Chinese diagnostics; normalize only known messages.
const sourceKeys: Readonly<Record<string, string>> = {
    '列组包含不支持的子元素，只能在源码模式中修改。':
        'The column group contains unsupported children. Edit it in Source.',
    '列组不能同时使用 span 和 col 子项。':
        'A column group cannot use both span and col children.',
    '列组包含无效的 span。': 'The column group contains an invalid span.',
    '部分 tr 直接位于 table 下，可安全放入显式 tbody。':
        'Some tr elements are directly under table. They can safely move into an explicit tbody.',
    '存在无属性、无内容的重复空分区，可安全移除。':
        'Duplicate empty sections without attributes can safely be removed.',
    '请选择至少两个相邻单元格。': 'Select at least two adjacent cells.',
    '不能跨越表头、表体或表尾分区合并。':
        'Cannot merge across header, body or footer sections.',
    '所选区域包含跨度冲突，请选择完整矩形单元格。':
        'The selection contains span conflicts. Select a complete rectangle of cells.',
    '拆分操作一次只能处理一个单元格。': 'Split one cell at a time.',
    '当前单元格没有可拆分的跨度。': 'This cell has no span to split.',
};

export function translateTableContextMessage(
    message: string,
    translate: (key: string) => string,
): string {
    const coverage = /^列组覆盖 (\d+) 列，但表格有 (\d+) 个逻辑列。$/u.exec(
        message,
    );
    if (coverage !== null)
        return translate(
            'Column groups cover {columns} columns, but the table has {total} logical columns.',
        )
            .replace('{columns}', coverage[1] ?? '')
            .replace('{total}', coverage[2] ?? '');
    return translate(sourceKeys[message] ?? message);
}
