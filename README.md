# 本機小說閱讀器

這是一個可以放到 GitHub Pages 的純前端小說閱讀網站。使用者手動選擇電腦中的小說檔案後，網站會在瀏覽器內讀取內容，不會把小說上傳到任何伺服器。

## 功能

- 支援 TXT、DOCX、EPUB
- TXT 可選 UTF-8、Big5、GB18030 編碼
- 自動偵測章節，例如：第1章、第十二章、第三百零五章、Chapter 1
- 章節顯示在「章節列表」
- 可搜尋章節
- 上一章 / 下一章
- 複製目前章節
- 字體大小和行距調整
- 自動填滿內容寬度：會把 TXT 裡固定換行造成的右側空白整理成自動換行
- 左側欄可整體收起 / 打開
- 載入小說、閱讀設定、章節列表三個方格可分別收起 / 打開
- 全螢幕閱讀模式
- 深色模式

## 使用方法

1. 開啟 `index.html`。
2. 按「選擇小說檔案」。
3. 選擇 TXT、DOCX 或 EPUB。
4. 網站會自動解析章節，並在左側章節列表顯示。

## 部署到 GitHub Pages

1. 建立一個 GitHub repository。
2. 上傳 `index.html`、`style.css`、`app.js`、`README.md`。
3. 到 repository 的 `Settings` → `Pages`。
4. Source 選擇要發佈的 branch，例如 `main`。
5. 儲存後等待 GitHub 生成網站網址。

## 注意

- `.docx` 需要透過 CDN 載入 Mammoth.js。
- `.epub` 需要透過 CDN 載入 JSZip。
- 舊式 `.doc` 是二進制 Word 格式，不建議在純前端網頁解析；請先另存為 `.docx` 或 `.txt`。
