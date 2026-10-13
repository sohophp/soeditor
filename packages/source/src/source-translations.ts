// Loaded with Source only; English keeps CodeMirror's native messages.
const messages: readonly (readonly [string, string, string])[] = [
    ['Color scheme', '配色', '配色'],
    ['Source color scheme', '源码配色', '原始碼配色'],
    ['Default (light)', '默认（浅色）', '預設（淺色）'],
    ['Dark', '暗色', '暗色'],
    ['HTML source editor', 'HTML 源码编辑器', 'HTML 原始碼編輯器'],
    ['HTML source scroll area', 'HTML 源码滚动区域', 'HTML 原始碼捲動區域'],
    ['Find', '查找', '尋找'],
    ['Replace', '替换', '取代'],
    ['next', '下一项', '下一項'],
    ['previous', '上一项', '上一項'],
    ['all', '全部', '全部'],
    ['match case', '区分大小写', '區分大小寫'],
    ['regexp', '正则表达式', '正規表示式'],
    ['by word', '全词匹配', '全字匹配'],
    ['replace', '替换', '取代'],
    ['replace all', '全部替换', '全部取代'],
    ['close', '关闭', '關閉'],
    ['Go to line', '跳至行', '跳至列'],
    ['go', '跳转', '跳轉'],
    ['Diagnostics', '诊断', '診斷'],
    ['No diagnostics', '没有诊断信息', '沒有診斷資訊'],
    ['Completions', '补全建议', '補全建議'],
    ['Control character', '控制字符', '控制字元'],
    ['current match', '当前匹配', '目前符合項目'],
    ['on line', '位于行', '位於列'],
    [
        'replaced match on line $',
        '已替换第 $ 行的匹配',
        '已取代第 $ 列的符合項目',
    ],
    ['replaced $ matches', '已替换 $ 项匹配', '已取代 $ 個符合項目'],
];

export function sourcePhrases(
    element: HTMLElement,
): Readonly<Record<string, string>> {
    const locale = (
        element.closest<HTMLElement>('[lang]')?.lang ??
        element.ownerDocument.documentElement.lang
    ).replaceAll('_', '-');
    if (!/^zh(?:-|$)/iu.test(locale)) return {};
    const index = /^zh-(?:tw|hk|hant)(?:-|$)/iu.test(locale) ? 2 : 1;
    return Object.fromEntries(
        messages.map((entry) => [entry[0], entry[index]]),
    );
}
