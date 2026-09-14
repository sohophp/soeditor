# 相對網址基址

在 `createClassicEditor` 的 CMS 設定中加入 `baseHref: 'https://www.example.com/assets/'`。亦可使用 `/assets/` 等相對於宿主文件的地址；目錄地址須保留尾端 `/`，只接受 HTTP/HTTPS。

每個實例分別解析相對圖片、連結、一般 srcset、poster 及行內 CSS `url(...)`。儲存的 HTML 保留相對屬性，不修改宿主文件。預覽沿用相同基址，也可用 `preview.baseUrl` 覆寫。未設定時維持原本瀏覽器行為。

此選項不改變上傳目錄、伺服器儲存路徑或內容安全策略。

圖片屬性視窗讀取正文原始的 `src`、`srcset` 與圖片連結 `href`。預覽層解析出的絕對網址不作為屬性初始值，更新圖片時也不會寫回正文。
