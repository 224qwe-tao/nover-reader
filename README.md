# GitHub 小說閱讀器

這是一個可以放到 GitHub Pages 的純前端小說閱讀網站。使用者手動選擇電腦中的小說檔案後，網站會在瀏覽器內讀取內容，並可把小說資料保存到指定 GitHub repository。

## 功能

- 支援 TXT、DOCX、EPUB
- TXT 可選 UTF-8、Big5、GB18030 編碼
- 自動偵測章節，例如：第1章、第十二章、第三百零五章、Chapter 1
- 章節顯示在「章節列表」
- 可搜尋章節
- 上一章 / 下一章
- 複製目前章節
- 字體大小和行距調整
- 「自動填滿內容寬度」預設關閉，可手動打開
- 左側欄為類似 PDF 閱讀器的展開 / 收起效果：收起後只保留一條窄工具欄和選單按鈕
- 載入小說、GitHub 保存 / 書庫、閱讀設定、章節列表四個方格可分別收起 / 打開
- 全螢幕閱讀模式
- 深色模式
- GitHub 書庫保存功能：可保存已載入小說、命名、分類，下次打開網站後可從 GitHub 書庫讀取
- 已保存小說可刪除、改名、改分類

## GitHub 保存功能說明

網站會在你指定的 repository 內建立資料資料夾，例如：

```text
novel-library/
  index.json
  books/
    book-xxxxxxxx.json
```

- `index.json`：保存書庫列表、分類、章節數、更新時間。
- `books/*.json`：保存小說正文、章節位置、目前章節等資料。
- GitHub Token 只會保存在目前瀏覽器的 `localStorage`，不會寫入 repository。
- 若 repository 是私人 repository，讀取和寫入都需要 Token。
- 若 repository 是公開 repository，讀取可以不輸入 Token，但寫入仍需要 Token。

## GitHub Token 建議權限

使用 fine-grained personal access token 時，建議只授權指定 repository，並給予 Contents 的 Read and write 權限。不要把 Token 寫進 `index.html`、`app.js` 或任何會上傳到 GitHub 的檔案。

## 使用方法

1. 開啟網站。
2. 在左側「GitHub 保存 / 書庫」輸入：
   - GitHub 帳號 / 組織
   - Repository
   - Branch，例如 `main`
   - 資料資料夾，例如 `novel-library`
   - GitHub Token
3. 按「保存 GitHub 設定」。
4. 按「讀取 GitHub 書庫」。第一次使用時會顯示沒有小說。
5. 按「選擇小說檔案」，選擇 TXT、DOCX 或 EPUB。
6. 網站會自動解析章節，並在左側章節列表顯示。
7. 在「保存名稱」和「分類」輸入資料。
8. 按「保存到 GitHub」。
9. 下次打開同一網站時，按「讀取 GitHub 書庫」，即可打開已保存小說。

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
- 如果多人共用同一個 repository，同時保存同一本小說可能會出現版本衝突。遇到衝突時，請先按「讀取 GitHub 書庫」，再重新保存。
