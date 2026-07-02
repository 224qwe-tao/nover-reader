const DB_NAME = "githubLocalNovelReaderDB";
const DB_VERSION = 1;
const BOOK_STORE = "books";
const ALL_CATEGORIES = "__all__";

const appShell = document.getElementById("appShell");
const fileInput = document.getElementById("fileInput");
const encodingSelect = document.getElementById("encodingSelect");
const statusText = document.getElementById("statusText");
const chapterList = document.getElementById("chapterList");
const chapterCount = document.getElementById("chapterCount");
const chapterSearch = document.getElementById("chapterSearch");
const bookTitle = document.getElementById("bookTitle");
const chapterTitle = document.getElementById("chapterTitle");
const readerContent = document.getElementById("readerContent");
const sidebarToggle = document.getElementById("sidebarToggle");
const prevChapter = document.getElementById("prevChapter");
const nextChapter = document.getElementById("nextChapter");
const copyChapter = document.getElementById("copyChapter");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const fontSizeRange = document.getElementById("fontSizeRange");
const lineHeightRange = document.getElementById("lineHeightRange");
const autoFillToggle = document.getElementById("autoFillToggle");
const fullBookToggle = document.getElementById("fullBookToggle");
const themeToggle = document.getElementById("themeToggle");
const saveTitleInput = document.getElementById("saveTitleInput");
const saveCategoryInput = document.getElementById("saveCategoryInput");
const categoryOptions = document.getElementById("categoryOptions");
const categoryFilter = document.getElementById("categoryFilter");
const saveBookButton = document.getElementById("saveBookButton");
const saveAsBookButton = document.getElementById("saveAsBookButton");
const savedBookList = document.getElementById("savedBookList");

let currentBook = createEmptyBook();
let savedBooks = [];
let activeSavedId = null;
let dbPromise = null;
let progressSaveTimer = null;

const CHAPTER_LINE_REGEX = /^\s*(第\s*([0-9０-９]+|[零〇○一二兩两三四五六七八九十百千萬万億亿]+)\s*(章|節|节|回|話|话|卷|集|部|篇)\s*[^\n]{0,80}|chapter\s+[0-9]+\s*[^\n]{0,80})\s*$/i;
const CHAPTER_GLOBAL_REGEX = /(?:^|\n)\s*(第\s*(?:[0-9０-９]+|[零〇○一二兩两三四五六七八九十百千萬万億亿]+)\s*(?:章|節|节|回|話|话|卷|集|部|篇)\s*[^\n]{0,80}|chapter\s+[0-9]+\s*[^\n]{0,80})\s*(?=\n|$)/gi;

fileInput.addEventListener("change", handleFileSelect);
chapterSearch.addEventListener("input", renderChapterList);
sidebarToggle.addEventListener("click", toggleSidebar);
prevChapter.addEventListener("click", () => openChapter(currentBook.currentIndex - 1));
nextChapter.addEventListener("click", () => openChapter(currentBook.currentIndex + 1));
copyChapter.addEventListener("click", copyCurrentChapter);
fullscreenToggle.addEventListener("click", toggleFullscreen);
autoFillToggle.addEventListener("change", () => openChapter(currentBook.currentIndex, false));
fullBookToggle.addEventListener("change", () => {
  openChapter(currentBook.currentIndex, false);
  updateNavButtons();
});
fontSizeRange.addEventListener("input", updateReadingStyle);
lineHeightRange.addEventListener("input", updateReadingStyle);
themeToggle.addEventListener("click", toggleTheme);
saveBookButton.addEventListener("click", () => saveCurrentBook(false));
saveAsBookButton.addEventListener("click", () => saveCurrentBook(true));
categoryFilter.addEventListener("change", renderSavedBooks);
encodingSelect.addEventListener("change", () => {
  if (fileInput.files?.[0] && fileInput.files[0].name.toLowerCase().endsWith(".txt")) {
    handleFile(fileInput.files[0]);
  }
});

document.querySelectorAll("[data-toggle-panel]").forEach((button) => {
  button.addEventListener("click", () => togglePanel(button));
});

document.addEventListener("fullscreenchange", updateFullscreenState);

restoreUiState();
updateReadingStyle();
updateNavButtons();
initLibrary();

function createEmptyBook() {
  return {
    title: "",
    fileName: "",
    text: "",
    chapters: [],
    currentIndex: 0,
  };
}

async function initLibrary() {
  try {
    dbPromise = openLibraryDb();
    await dbPromise;
    await refreshSavedBooks();
  } catch (error) {
    console.error(error);
    setStatus("本機書庫初始化失敗：此瀏覽器可能限制了 IndexedDB。仍可直接載入檔案閱讀。");
  }
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await handleFile(file);
}

async function handleFile(file) {
  try {
    setStatus(`正在讀取：${file.name}`);
    const fileName = file.name;
    const ext = getExtension(fileName);
    let text = "";

    if (ext === "txt") {
      text = await readTxt(file);
    } else if (ext === "docx") {
      text = await readDocx(file);
    } else if (ext === "epub") {
      text = await readEpub(file);
    } else if (ext === "doc") {
      throw new Error("舊式 .doc 格式無法在純前端網站穩定解析，請先用 Word / Google Docs / LibreOffice 另存為 .docx 或 .txt。");
    } else {
      throw new Error("暫時只支援 TXT、DOCX、EPUB。舊式 DOC 請先轉成 DOCX 或 TXT。");
    }

    const normalizedText = normalizeText(text);
    const chapters = detectChapters(normalizedText);
    const title = removeExtension(fileName);

    activeSavedId = null;
    currentBook = {
      title,
      fileName,
      text: normalizedText,
      chapters,
      currentIndex: 0,
    };

    saveTitleInput.value = title;
    if (!saveCategoryInput.value.trim()) saveCategoryInput.value = "未分類";
    bookTitle.textContent = currentBook.title;
    chapterCount.textContent = chapters.length;
    chapterSearch.value = "";
    renderChapterList();
    openChapter(0, false);
    updateSaveButtons();
    renderSavedBooks();
    setStatus(`已載入：${fileName}，偵測到 ${chapters.length} 個章節。可按「保存」加入本機書庫。`);
  } catch (error) {
    console.error(error);
    setStatus(`讀取失敗：${error.message}`);
    bookTitle.textContent = "讀取失敗";
    chapterTitle.textContent = "請檢查檔案格式";
    readerContent.textContent = error.message;
  }
}

async function readTxt(file) {
  const buffer = await file.arrayBuffer();
  const encoding = encodingSelect.value || "utf-8";
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function readDocx(file) {
  if (!window.mammoth) {
    throw new Error("DOCX 解析工具尚未載入，請確認網絡可連接 CDN。");
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  const html = result.value || "";
  return htmlToText(html);
}

async function readEpub(file) {
  if (!window.JSZip) {
    throw new Error("EPUB 解析工具尚未載入，請確認網絡可連接 CDN。");
  }

  const buffer = await file.arrayBuffer();
  const zip = await window.JSZip.loadAsync(buffer);
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("EPUB 結構不完整：找不到 META-INF/container.xml。");

  const containerXml = await containerFile.async("string");
  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
  const rootfile = containerDoc.querySelector("rootfile");
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB 結構不完整：找不到 OPF 路徑。");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB 結構不完整：找不到 OPF 檔案。");

  const opfXml = await opfFile.async("string");
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");
  const opfDir = getDirectory(opfPath);

  const manifest = new Map();
  opfDoc.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, normalizePath(opfDir + href));
  });

  const spineItems = Array.from(opfDoc.querySelectorAll("spine itemref"));
  const textParts = [];

  for (const itemref of spineItems) {
    const idref = itemref.getAttribute("idref");
    const contentPath = manifest.get(idref);
    const chapterFile = contentPath ? zip.file(contentPath) : null;
    if (!chapterFile) continue;

    const chapterHtml = await chapterFile.async("string");
    const chapterText = htmlToText(chapterHtml).trim();
    if (chapterText) textParts.push(chapterText);
  }

  if (!textParts.length) throw new Error("EPUB 內沒有讀取到可顯示的正文內容。");
  return textParts.join("\n\n");
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav, iframe").forEach((node) => node.remove());
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, div, section, article, h1, h2, h3, h4, h5, h6, li").forEach((node) => {
    node.appendChild(doc.createTextNode("\n"));
  });
  return doc.body.textContent || "";
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function detectChapters(text) {
  const lineBased = detectChaptersByLines(text);
  if (lineBased.length > 1) return lineBased;

  const globalBased = detectChaptersByRegex(text);
  if (globalBased.length > 1) return globalBased;

  return [{ title: "全文", start: 0, end: text.length, content: text }];
}

function detectChaptersByLines(text) {
  const lines = text.split("\n");
  const markers = [];
  let position = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.length <= 90 && CHAPTER_LINE_REGEX.test(trimmed)) {
      markers.push({ title: trimmed, start: position });
    }
    position += line.length + 1;
  });

  return buildChaptersFromMarkers(text, markers);
}

function detectChaptersByRegex(text) {
  const markers = [];
  let match;
  CHAPTER_GLOBAL_REGEX.lastIndex = 0;
  while ((match = CHAPTER_GLOBAL_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const title = raw.trim();
    const start = match.index + raw.indexOf(title);
    markers.push({ title, start });
  }
  return buildChaptersFromMarkers(text, markers);
}

function buildChaptersFromMarkers(text, markers) {
  const uniqueMarkers = [];
  const seenStarts = new Set();

  markers.forEach((marker) => {
    if (!seenStarts.has(marker.start)) {
      seenStarts.add(marker.start);
      uniqueMarkers.push(marker);
    }
  });

  uniqueMarkers.sort((a, b) => a.start - b.start);

  return uniqueMarkers.map((marker, index) => {
    const next = uniqueMarkers[index + 1];
    const end = next ? next.start : text.length;
    return {
      title: marker.title,
      start: marker.start,
      end,
      content: text.slice(marker.start, end).trim(),
    };
  });
}

function hydrateChapters(text, storedChapters) {
  if (!Array.isArray(storedChapters) || !storedChapters.length) return detectChapters(text);

  return storedChapters.map((chapter, index) => {
    const start = Number.isFinite(chapter.start) ? chapter.start : 0;
    const end = Number.isFinite(chapter.end) ? chapter.end : text.length;
    return {
      title: chapter.title || `第 ${index + 1} 章`,
      start,
      end,
      content: text.slice(start, end).trim(),
    };
  });
}

function serializeChapters(chapters) {
  return chapters.map((chapter) => ({
    title: chapter.title,
    start: chapter.start,
    end: chapter.end,
  }));
}

function renderChapterList() {
  const keyword = chapterSearch.value.trim().toLowerCase();
  chapterList.innerHTML = "";

  currentBook.chapters.forEach((chapter, index) => {
    if (keyword && !chapter.title.toLowerCase().includes(keyword)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `chapter-item${index === currentBook.currentIndex ? " active" : ""}`;
    button.textContent = chapter.title || `第 ${index + 1} 章`;
    button.addEventListener("click", () => openChapter(index));
    chapterList.appendChild(button);
  });

  if (!chapterList.children.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "沒有符合搜尋的章節。";
    chapterList.appendChild(empty);
  }
}

function openChapter(index, shouldScroll = true) {
  if (!currentBook.chapters.length) return;
  if (index < 0 || index >= currentBook.chapters.length) return;

  currentBook.currentIndex = index;
  const chapter = currentBook.chapters[index];
  const rawText = fullBookToggle.checked ? currentBook.text : chapter.content;

  chapterTitle.textContent = fullBookToggle.checked ? "全文模式" : chapter.title || `第 ${index + 1} 章`;
  readerContent.textContent = autoFillToggle.checked ? formatForAutoFill(rawText) : rawText;
  renderChapterList();
  updateNavButtons();

  if (activeSavedId) {
    updateSavedBookCurrentIndexInMemory(activeSavedId, index);
    scheduleProgressSave(activeSavedId, index);
  }

  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function formatForAutoFill(text) {
  const lines = text.split("\n");
  const paragraphs = [];
  let buffer = [];

  const flushBuffer = () => {
    if (!buffer.length) return;
    paragraphs.push(joinParagraphLines(buffer));
    buffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBuffer();
      return;
    }

    if (CHAPTER_LINE_REGEX.test(trimmed)) {
      flushBuffer();
      paragraphs.push(trimmed);
      return;
    }

    const looksLikeNewParagraph = /^[\s\u3000]{2,}\S/.test(line) || /^　+\S/.test(line);
    if (looksLikeNewParagraph && buffer.length) {
      flushBuffer();
    }

    buffer.push(trimmed);
  });

  flushBuffer();
  return paragraphs.join("\n\n");
}

function joinParagraphLines(lines) {
  return lines.reduce((result, line, index) => {
    if (index === 0) return line;
    const previousChar = result.slice(-1);
    const firstChar = line.charAt(0);
    const needsSpace = shouldInsertSpace(previousChar, firstChar);
    return result + (needsSpace ? " " : "") + line;
  }, "");
}

function shouldInsertSpace(previousChar, firstChar) {
  if (!previousChar || !firstChar) return false;
  const cjkOrPunctuation = /[\u3400-\u9fff\uf900-\ufaff，。！？；：「」『』（）《》、…—]/;
  return !cjkOrPunctuation.test(previousChar) && !cjkOrPunctuation.test(firstChar);
}

async function saveCurrentBook(forceNew) {
  if (!currentBook.text) {
    setStatus("沒有可保存的小說。請先載入 TXT / DOCX / EPUB 檔案。");
    return;
  }

  try {
    const db = await ensureDb();
    const now = new Date().toISOString();
    const title = saveTitleInput.value.trim() || currentBook.title || "未命名小說";
    const category = saveCategoryInput.value.trim() || "未分類";
    const id = !forceNew && activeSavedId ? activeSavedId : createBookId();
    const existing = !forceNew && activeSavedId ? await getBookById(db, activeSavedId) : null;

    const record = {
      id,
      title,
      category,
      fileName: currentBook.fileName || existing?.fileName || `${title}.txt`,
      text: currentBook.text,
      chapters: serializeChapters(currentBook.chapters),
      currentIndex: currentBook.currentIndex,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await putBook(db, record);
    activeSavedId = id;
    currentBook.title = title;
    bookTitle.textContent = title;
    await refreshSavedBooks();
    setStatus(forceNew ? `已另存新書：${title}` : `已保存：${title}`);
  } catch (error) {
    console.error(error);
    setStatus(`保存失敗：${error.message}`);
  }
}

async function refreshSavedBooks() {
  const db = await ensureDb();
  savedBooks = await getAllBooks(db);
  savedBooks.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  renderCategoryControls();
  renderSavedBooks();
  updateSaveButtons();
}

function renderCategoryControls() {
  const selected = categoryFilter.value || ALL_CATEGORIES;
  const categories = Array.from(new Set(savedBooks.map((book) => book.category || "未分類"))).sort((a, b) => a.localeCompare(b, "zh-Hant"));

  categoryOptions.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    categoryOptions.appendChild(option);
  });

  categoryFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = ALL_CATEGORIES;
  allOption.textContent = "全部分類";
  categoryFilter.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = categories.includes(selected) ? selected : ALL_CATEGORIES;
}

function renderSavedBooks() {
  savedBookList.innerHTML = "";
  const selectedCategory = categoryFilter.value || ALL_CATEGORIES;
  const visibleBooks = savedBooks.filter((book) => selectedCategory === ALL_CATEGORIES || (book.category || "未分類") === selectedCategory);

  if (!visibleBooks.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = savedBooks.length ? "這個分類暫時沒有小說。" : "尚未保存小說。載入檔案後按「保存」即可加入本機書庫。";
    savedBookList.appendChild(empty);
    return;
  }

  visibleBooks.forEach((book) => {
    const card = document.createElement("div");
    card.className = `saved-book-card${book.id === activeSavedId ? " active" : ""}`;

    const title = document.createElement("div");
    title.className = "saved-book-title";
    title.textContent = book.title || "未命名小說";

    const meta = document.createElement("div");
    meta.className = "saved-book-meta";
    meta.textContent = `${book.category || "未分類"} · ${book.chapters?.length || 1} 章節 · ${formatDate(book.updatedAt || book.createdAt)}`;

    const actions = document.createElement("div");
    actions.className = "saved-book-actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "打開";
    openBtn.addEventListener("click", () => loadSavedBook(book.id));

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "改名/分類";
    renameBtn.addEventListener("click", () => prepareEditSavedBook(book.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.addEventListener("click", () => deleteSavedBook(book.id));

    actions.append(openBtn, renameBtn, deleteBtn);
    card.append(title, meta, actions);
    savedBookList.appendChild(card);
  });
}

async function loadSavedBook(id) {
  try {
    const db = await ensureDb();
    const record = await getBookById(db, id);
    if (!record) throw new Error("找不到這本已保存小說。可能已被刪除。");

    const text = normalizeText(record.text || "");
    const chapters = hydrateChapters(text, record.chapters);
    activeSavedId = record.id;
    currentBook = {
      title: record.title || "未命名小說",
      fileName: record.fileName || "",
      text,
      chapters,
      currentIndex: clamp(record.currentIndex || 0, 0, Math.max(chapters.length - 1, 0)),
    };

    saveTitleInput.value = currentBook.title;
    saveCategoryInput.value = record.category || "未分類";
    bookTitle.textContent = currentBook.title;
    chapterCount.textContent = chapters.length;
    chapterSearch.value = "";
    renderChapterList();
    openChapter(currentBook.currentIndex, false);
    updateSaveButtons();
    renderSavedBooks();
    setStatus(`已從本機書庫打開：${currentBook.title}`);
  } catch (error) {
    console.error(error);
    setStatus(`打開失敗：${error.message}`);
  }
}

async function prepareEditSavedBook(id) {
  await loadSavedBook(id);
  setStatus("已打開這本小說並填入保存名稱和分類。修改後按「更新保存」即可改名或更改分類。");
}

async function deleteSavedBook(id) {
  const book = savedBooks.find((item) => item.id === id);
  const confirmed = window.confirm(`確定要刪除「${book?.title || "這本小說"}」的本機保存資料嗎？`);
  if (!confirmed) return;

  try {
    const db = await ensureDb();
    await deleteBookById(db, id);
    if (activeSavedId === id) activeSavedId = null;
    await refreshSavedBooks();
    setStatus("已刪除本機保存資料。已載入的閱讀內容不會立即消失，但不再連結到書庫記錄。");
  } catch (error) {
    console.error(error);
    setStatus(`刪除失敗：${error.message}`);
  }
}

function updateSavedBookCurrentIndexInMemory(id, index) {
  const book = savedBooks.find((item) => item.id === id);
  if (book) book.currentIndex = index;
}

function scheduleProgressSave(id, index) {
  window.clearTimeout(progressSaveTimer);
  progressSaveTimer = window.setTimeout(async () => {
    try {
      const db = await ensureDb();
      const record = await getBookById(db, id);
      if (!record) return;
      record.currentIndex = index;
      record.lastReadAt = new Date().toISOString();
      await putBook(db, record);
    } catch (error) {
      console.warn("閱讀進度保存失敗", error);
    }
  }, 700);
}

function updateSaveButtons() {
  const hasBook = Boolean(currentBook.text);
  saveBookButton.disabled = !hasBook;
  saveAsBookButton.disabled = !hasBook;
  saveBookButton.textContent = activeSavedId ? "更新保存" : "保存";
}

function openLibraryDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("此瀏覽器不支援 IndexedDB。"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOK_STORE)) {
        const store = db.createObjectStore(BOOK_STORE, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 開啟失敗。"));
  });
}

async function ensureDb() {
  if (!dbPromise) dbPromise = openLibraryDb();
  return dbPromise;
}

function getAllBooks(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, "readonly");
    const store = tx.objectStore(BOOK_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("讀取書庫失敗。"));
  });
}

function getBookById(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, "readonly");
    const store = tx.objectStore(BOOK_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("讀取小說失敗。"));
  });
}

function putBook(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, "readwrite");
    const store = tx.objectStore(BOOK_STORE);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("保存小說失敗。"));
  });
}

function deleteBookById(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, "readwrite");
    const store = tx.objectStore(BOOK_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("刪除小說失敗。"));
  });
}

function updateNavButtons() {
  const hasChapters = currentBook.chapters.length > 0;
  prevChapter.disabled = !hasChapters || currentBook.currentIndex <= 0 || fullBookToggle.checked;
  nextChapter.disabled = !hasChapters || currentBook.currentIndex >= currentBook.chapters.length - 1 || fullBookToggle.checked;
  copyChapter.disabled = !hasChapters;
}

async function copyCurrentChapter() {
  const text = fullBookToggle.checked ? currentBook.text : currentBook.chapters[currentBook.currentIndex]?.content;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("已複製目前內容。");
  } catch {
    setStatus("瀏覽器不允許直接複製，請手動選取文字複製。");
  }
}

function updateReadingStyle() {
  document.documentElement.style.setProperty("--reader-font-size", `${fontSizeRange.value}px`);
  document.documentElement.style.setProperty("--reader-line-height", lineHeightRange.value);
}

function toggleSidebar() {
  appShell.classList.toggle("sidebar-collapsed");
  const collapsed = appShell.classList.contains("sidebar-collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.title = collapsed ? "打開左側" : "收起左側";
  localStorage.setItem("novelReader.sidebarCollapsed", collapsed ? "1" : "0");
}

function togglePanel(button) {
  const panelKey = button.dataset.togglePanel;
  const panel = document.querySelector(`[data-panel="${panelKey}"]`);
  if (!panel) return;
  panel.classList.toggle("collapsed");
  const collapsed = panel.classList.contains("collapsed");
  button.textContent = collapsed ? "▸" : "▾";
  button.setAttribute("aria-expanded", String(!collapsed));
  localStorage.setItem(`novelReader.panel.${panelKey}`, collapsed ? "1" : "0");
}

function restoreUiState() {
  const sidebarCollapsed = localStorage.getItem("novelReader.sidebarCollapsed") === "1";
  appShell.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  sidebarToggle.setAttribute("aria-expanded", String(!sidebarCollapsed));
  sidebarToggle.title = sidebarCollapsed ? "打開左側" : "收起左側";

  document.querySelectorAll("[data-toggle-panel]").forEach((button) => {
    const panelKey = button.dataset.togglePanel;
    const panel = document.querySelector(`[data-panel="${panelKey}"]`);
    const collapsed = localStorage.getItem(`novelReader.panel.${panelKey}`) === "1";
    if (!panel) return;
    panel.classList.toggle("collapsed", collapsed);
    button.textContent = collapsed ? "▸" : "▾";
    button.setAttribute("aria-expanded", String(!collapsed));
  });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    setStatus("瀏覽器未允許全螢幕模式，請確認網頁權限或直接按 F11。");
  }
}

function updateFullscreenState() {
  const isFullscreen = Boolean(document.fullscreenElement);
  document.body.classList.toggle("fullscreen-mode", isFullscreen);
  fullscreenToggle.textContent = isFullscreen ? "退出全螢幕" : "全螢幕";
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "淺色模式" : "深色模式";
}

function setStatus(message) {
  statusText.textContent = message;
}

function getExtension(fileName) {
  return fileName.split(".").pop().toLowerCase();
}

function removeExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function getDirectory(path) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

function normalizePath(path) {
  const parts = [];
  path.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function createBookId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `book-${Date.now()}-${random}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDate(value) {
  if (!value) return "未知時間";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知時間";
  return date.toLocaleString("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
