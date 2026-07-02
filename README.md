# 本機小說閱讀器 GitHub Pages 版

這是一個純前端小說閱讀網站，適合直接部署到 GitHub Pages。

## 功能

- 使用者手動選擇本機小說檔案，不需要把小說上傳到網站或 GitHub。
- 支援 TXT、DOCX、EPUB。
- 自動偵測章節標題，例如：
  - 第1章
  - 第十二章
  - 第三百零五章
  - 第1節 / 第十回 / 第三卷
- 自動建立「章節列表」。
- 可調整字體大小、行距、深色模式。
- 可切換全文模式。

## 注意

舊式 Word `.doc` 是二進制格式，純前端 GitHub Pages 網站無法穩定解析。建議先用 Microsoft Word、Google Docs 或 LibreOffice 另存為 `.docx` 或 `.txt`。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個 repository。
2. 上傳 `index.html`、`style.css`、`app.js`。
3. 到 repository 的 Settings > Pages。
4. Source 選擇 `Deploy from a branch`。
5. Branch 選擇 `main`，資料夾選擇 `/root`。
6. 儲存後等待 GitHub 產生網址。

## 檔案用途

- `index.html`：網站主頁。
- `style.css`：網站外觀。
- `app.js`：讀取 TXT / DOCX / EPUB、章節偵測和閱讀器功能。
