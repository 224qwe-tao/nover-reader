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

let currentBook = {
  title: "",
  text: "",
  chapters: [],
  currentIndex: 0,
};

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
fullBookToggle.addEventListener("change", () => openChapter(currentBook.currentIndex, false));
fontSizeRange.addEventListener("input", updateReadingStyle);
lineHeightRange.addEventListener("input", updateReadingStyle);
themeToggle.addEventListener("click", toggleTheme);
encodingSelect.addEventListener("change", () => {
  if (fileInput.files?.[0] && fileInput.files[0].name.toLowerCase().endsWith(".txt")) {
    handleFile(fileInput.files[0]);
  }
});

document.querySelectorAll("[data-toggle-panel]").forEach((button) => {
  button.addEventListener("click", () => togglePanel(button));
});

document.addEventListener("fullscreenchange", updateFullscreenState);

updateReadingStyle();
updateNavButtons();

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

    currentBook = {
      title: removeExtension(fileName),
      text: normalizedText,
      chapters,
      currentIndex: 0,
    };

    bookTitle.textContent = currentBook.title;
    chapterCount.textContent = chapters.length;
    chapterSearch.value = "";
    renderChapterList();
    openChapter(0, false);
    setStatus(`已載入：${fileName}，偵測到 ${chapters.length} 個章節。`);
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

  chapterTitle.textContent = chapter.title || `第 ${index + 1} 章`;
  readerContent.textContent = autoFillToggle.checked ? formatForAutoFill(rawText) : rawText;
  renderChapterList();
  updateNavButtons();

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
    setStatus("已複製目前內容。 ");
  } catch {
    setStatus("瀏覽器不允許直接複製，請手動選取文字複製。 ");
  }
}

function updateReadingStyle() {
  document.documentElement.style.setProperty("--reader-font-size", `${fontSizeRange.value}px`);
  document.documentElement.style.setProperty("--reader-line-height", lineHeightRange.value);
}

function toggleSidebar() {
  appShell.classList.toggle("sidebar-collapsed");
  sidebarToggle.textContent = appShell.classList.contains("sidebar-collapsed") ? "打開左側" : "收起左側";
}

function togglePanel(button) {
  const panelKey = button.dataset.togglePanel;
  const panel = document.querySelector(`[data-panel="${panelKey}"]`);
  if (!panel) return;
  panel.classList.toggle("collapsed");
  button.textContent = panel.classList.contains("collapsed") ? "打開" : "收起";
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
