# CMS 回归语料

`legacy-product.html` 是人工编写的合成样本，不是客户脱敏文档，也不是从 Word/Excel 捕获的真实剪贴板。它覆盖历史表格属性、嵌套列表、中文与 emoji、未知组件、模板、注释及 inert 可执行内容。

自动流程在 `tests/browser/cms-multibrowser.spec.ts` 中验证打开、原生输入、Source 往返、保存、重新打开。真实文章及 Word/Excel 样本需记录来源应用版本、复制范围、预期清理结果，并先去除个人数据、访问令牌和客户机密；不得将真实素材标成已验证，除非实际执行并记录结果。

`performance/manifest.json` 列出三份生成的合成性能样本：长文章、图片列表和复杂表格。使用 `scripts/measure-cms-corpus.mjs` 记录本文档结构下的基线，不可将 `kind: synthetic` 改成真实来源声明。接入脱敏真实文章时创建独立清单并填写来源；不要覆盖这些固定回归样本。
