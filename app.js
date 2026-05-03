const state = {
  rules: null,
  phoneRules: null,
  template: "",
  templates: null,
  ready: false
};

const sampleText = `Подробнее о дебетовых бизнес-картах ПАО Сбербанк (ОГРН 1027700132195, адрес: 117312, г. Москва, ул. Вавилова, д. 19, [сайт](https://www.sberbank.ru/ru/person?utm_source=sendsay-kb&utm_medium=email&utm_campaing=opt-otr&utm_content=2896-otr-upravlenie-prodazhami-mobile-first-a&utm_term=ligal-text-1-1)), доступных юрлицам и ИП, а также лицам, занимающимся в установленном законодательством РФ порядке частной практикой, согласно договору бизнес-счёта, порядке оформления, стоимости, имеющихся ограничениях и иных условиях — [на сайте](https://www.sberbank.ru/ru/s_m_business/bankingservice/cards/corporatecards?utm_source=sendsay-kb&utm_medium=email&utm_campaing=opt-otr&utm_content=2896-otr-upravlenie-prodazhami-mobile-first-a&utm_term=ligal-text-1-2).`;

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  elements.sourceText.value = sampleText;
  configurePdfLibrary();
  loadAssets();
});

function bindElements() {
  elements.loadStatus = document.getElementById("loadStatus");
  elements.generateBtn = document.getElementById("generateBtn");
  elements.resetBtn = document.getElementById("resetBtn");
  elements.copyInputBtn = document.getElementById("copyInputBtn");
  elements.pasteSampleBtn = document.getElementById("pasteSampleBtn");
  elements.copyHtmlBtn = document.getElementById("copyHtmlBtn");
  elements.textModeBtn = document.getElementById("textModeBtn");
  elements.pdfModeBtn = document.getElementById("pdfModeBtn");
  elements.pdfPanel = document.getElementById("pdfPanel");
  elements.pdfInput = document.getElementById("pdfInput");
  elements.extractPdfBtn = document.getElementById("extractPdfBtn");
  elements.pdfStatus = document.getElementById("pdfStatus");
  elements.footnoteInput = document.getElementById("footnoteInput");
  elements.sourceText = document.getElementById("sourceText");
  elements.htmlOutput = document.getElementById("htmlOutput");
  elements.previewTable = document.getElementById("previewTable");
}

function bindEvents() {
  elements.generateBtn.addEventListener("click", generate);
  elements.resetBtn.addEventListener("click", resetForm);
  elements.pasteSampleBtn.addEventListener("click", () => {
    elements.sourceText.value = sampleText;
    generate();
  });
  elements.copyHtmlBtn.addEventListener("click", () => copyText(elements.htmlOutput.value, "HTML скопирован"));
  elements.copyInputBtn.addEventListener("click", () => copyText(elements.sourceText.value, "Текст скопирован"));
  elements.textModeBtn.addEventListener("click", () => setMode("text"));
  elements.pdfModeBtn.addEventListener("click", () => setMode("pdf"));
  elements.pdfInput.addEventListener("change", handlePdfExtraction);
  elements.extractPdfBtn.addEventListener("click", handlePdfExtraction);
  elements.sourceText.addEventListener("input", debounce(generate, 220));
  elements.footnoteInput.addEventListener("input", debounce(generate, 220));
}

function configurePdfLibrary() {
  if (!window.pdfjsLib) {
    setPdfStatus("PDF.js не загрузился", true);
    elements.extractPdfBtn.disabled = true;
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  setPdfStatus("PDF-режим готов");
  elements.extractPdfBtn.disabled = false;
}

async function loadAssets() {
  setReady(false);

  try {
    const [rulesResponse, phoneRulesResponse, templateResponse] = await Promise.all([
      fetch("rules.json", { cache: "no-store" }),
      fetch("phone-rules.json", { cache: "no-store" }),
      fetch("legal-template.html", { cache: "no-store" })
    ]);

    if (!rulesResponse.ok || !phoneRulesResponse.ok || !templateResponse.ok) {
      throw new Error("Не удалось загрузить rules.json, phone-rules.json или legal-template.html");
    }

    state.rules = await rulesResponse.json();
    state.phoneRules = await phoneRulesResponse.json();
    state.template = await templateResponse.text();
    state.templates = parseTemplateFile(state.template);
    state.ready = true;
    setStatus(`Готово: ${countConfiguredRules(state.rules)} правил, ${countPhoneRules(state.phoneRules)} телефонов`);
    setReady(true);
    generate();
  } catch (error) {
    state.ready = false;
    setStatus(error.message, true);
    setReady(false);
  }
}

function setReady(isReady) {
  elements.generateBtn.disabled = !isReady;
  elements.copyHtmlBtn.disabled = !isReady;
}

function setStatus(message, isError = false) {
  elements.loadStatus.textContent = message;
  elements.loadStatus.classList.toggle("error", isError);
}

function setPdfStatus(message, isError = false) {
  elements.pdfStatus.textContent = message;
  elements.pdfStatus.classList.toggle("error", isError);
}

function setMode(mode) {
  const isPdfMode = mode === "pdf";
  elements.pdfPanel.hidden = !isPdfMode;
  elements.textModeBtn.classList.toggle("active", !isPdfMode);
  elements.pdfModeBtn.classList.toggle("active", isPdfMode);
  elements.textModeBtn.setAttribute("aria-selected", String(!isPdfMode));
  elements.pdfModeBtn.setAttribute("aria-selected", String(isPdfMode));
}

function resetForm() {
  elements.footnoteInput.value = "1";
  elements.sourceText.value = "";
  generate();
}

async function handlePdfExtraction() {
  const file = elements.pdfInput.files?.[0];

  if (!file) {
    setPdfStatus("Выберите PDF-файл", true);
    return;
  }

  if (!window.pdfjsLib) {
    setPdfStatus("PDF.js не загрузился", true);
    return;
  }

  try {
    elements.extractPdfBtn.disabled = true;
    setPdfStatus(`Читаю ${file.name}`);
    const legalText = await extractLegalTextFromPdf(file);

    elements.sourceText.value = legalText;
    elements.footnoteInput.value = "";
    generate();
    setPdfStatus(`Найдено блоков: ${normalizeParagraphs(legalText).length}`);
  } catch (error) {
    setPdfStatus(error.message, true);
  } finally {
    elements.extractPdfBtn.disabled = false;
  }
}

function generate() {
  if (!state.ready) {
    return;
  }

  const footnoteHtml = renderFootnote(elements.footnoteInput.value.trim());
  const html = renderLegalRows(elements.sourceText.value, state.rules, state.phoneRules, state.templates, footnoteHtml);

  elements.htmlOutput.value = html;
  elements.previewTable.innerHTML = html;
}

function renderFootnote(value) {
  if (!value) {
    return "";
  }

  return `<span class="super" style="line-height: 0; font-size: 10px; vertical-align: super;">${escapeHtml(value)}</span> `;
}

function renderLegalRows(input, rules, phoneRules, templates, footnoteHtml = "") {
  const paragraphs = normalizeParagraphs(input);
  const rowTemplate = templates?.legalRow || templates || "";

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map((paragraph, index) => {
      const parsedParagraph = extractLeadingFootnote(paragraph);
      const rowFootnote = parsedParagraph.footnote
        ? renderFootnote(parsedParagraph.footnote)
        : index === 0 ? footnoteHtml : "";
      const content = renderParagraph(parsedParagraph.text, rules, phoneRules, templates);

      return rowTemplate
        .replaceAll("{{footnote}}", rowFootnote)
        .replaceAll("{{content}}", content)
        .trim();
    })
    .join("\n");
}

function extractLeadingFootnote(paragraph) {
  const match = paragraph.trim().match(/^(\d{1,2})[.)]?\s+([\s\S]+)$/);

  if (!match) {
    return { footnote: "", text: paragraph };
  }

  return {
    footnote: match[1],
    text: match[2].trim()
  };
}

function renderLegalContent(input, rules, phoneRules, templates = state.templates) {
  return normalizeParagraphs(input)
    .map((paragraph) => renderParagraph(paragraph, rules, phoneRules, templates))
    .join("<br><br>");
}

async function extractLegalTextFromPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await window.pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false
  }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
      normalizeWhitespace: true
    });

    pageTexts.push(textContentToPlainText(textContent));
  }

  const legalText = extractLegalTextFromPdfText(pageTexts.join("\n\n"));

  if (!legalText) {
    throw new Error("Лигалы не найдены в текстовом слое PDF");
  }

  return legalText;
}

function textContentToPlainText(textContent) {
  let text = "";

  for (const item of textContent.items || []) {
    if (!item.str) {
      continue;
    }

    text += item.str;
    text += item.hasEOL ? "\n" : " ";
  }

  return text;
}

function extractLegalTextFromPdfText(rawText) {
  const lines = normalizePdfTextLines(rawText);
  const startIndex = findLegalStartIndex(lines);

  if (startIndex !== -1) {
    const endIndex = findLegalEndIndex(lines, startIndex);
    const legalLines = lines.slice(startIndex, endIndex);
    const legalText = buildLegalBlocksFromLines(legalLines);

    if (legalText) {
      return legalText;
    }
  }

  return extractLegalTextFromContinuousPdfText(rawText);
}

function extractLegalTextFromContinuousPdfText(rawText) {
  const text = cleanLegalBlock(rawText.replace(/\n+/g, " "));
  const startIndex = findContinuousLegalStart(text);

  if (startIndex === -1) {
    return "";
  }

  const endIndex = findContinuousLegalEnd(text, startIndex);
  return splitContinuousLegalBlocks(text.slice(startIndex, endIndex));
}

function findContinuousLegalStart(text) {
  const expression = /(^|\s)(1)[.)]?\s+/g;
  let bestCandidate = { index: -1, score: 0 };
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const candidateText = text.slice(start, start + 1000);

    if (!hasLegalStartHint(candidateText)) {
      continue;
    }

    const score = getLegalTextScore(candidateText);

    if (score >= 2 && score > bestCandidate.score) {
      bestCandidate = { index: start, score };
    }
  }

  return bestCandidate.index;
}

function findContinuousLegalEnd(text, startIndex) {
  const tail = text.slice(startIndex);
  const replyMatch = tail.match(/не\s+предназначен[ао]?\s+для\s+ответа\.?/i);

  if (replyMatch) {
    return startIndex + replyMatch.index + replyMatch[0].length;
  }

  const stopMarkers = [
    " Установите сертификаты",
    " Смотреть в браузере",
    " Вам понравилось письмо?",
    " С уважением,"
  ];
  const stopIndexes = stopMarkers
    .map((marker) => text.indexOf(marker, startIndex + 1))
    .filter((index) => index !== -1);

  return stopIndexes.length > 0 ? Math.min(...stopIndexes) : text.length;
}

function splitContinuousLegalBlocks(text) {
  const markers = [];
  const expression = /(^|\s)(\d{1,2})[.)]?\s+(?=(?:ЮKassa|SberPay|Организатор|ПАО|ООО|НКО|Подробнее|Мобильное|QR-код|Реклама|Условия|[А-ЯЁA-Z][^\s]{2,}))/gu;
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const candidateText = text.slice(start, start + 600);

    if (getLegalTextScore(candidateText) > 0 || hasLegalStartHint(candidateText)) {
      markers.push(start);
    }
  }

  if (markers.length <= 1) {
    return cleanLegalBlock(text);
  }

  return markers
    .map((start, index) => cleanLegalBlock(text.slice(start, markers[index + 1] || text.length)))
    .filter((block) => getLegalTextScore(block) > 0)
    .join("\n\n");
}

function hasLegalStartHint(text) {
  return /^(?:1[.)]?\s+)?(?:ЮKassa|SberPay|Организатор|ПАО|ООО|НКО|Подробнее|Мобильное|QR-код|Реклама|Условия|[А-ЯЁA-Z][^\s]{2,})/u.test(text.trim());
}

function normalizePdfTextLines(rawText) {
  return rawText
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(cleanPdfLine)
    .filter(Boolean);
}

function cleanPdfLine(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+=\s*/g, "=")
    .replace(/=\s+/g, "=")
    .trim();
}

function findLegalStartIndex(lines) {
  const candidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!isFootnoteNumberLine(line) && !/^1[.)]?\s+\S/.test(line)) {
      continue;
    }

    const windowText = lines.slice(index, index + 10).join(" ");
    const score = getLegalTextScore(windowText);

    if (score >= 2) {
      candidates.push({ index, score });
    }
  }

  if (candidates.length === 0) {
    return -1;
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0].index;
}

function findLegalEndIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const windowText = lines.slice(Math.max(startIndex, index - 2), index + 1).join(" ");

    if (/не\s+предназначен[ао]?\s+для\s+ответа\.?/i.test(windowText)) {
      return index + 1;
    }
  }

  return lines.length;
}

function buildLegalBlocksFromLines(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (isFootnoteNumberLine(line)) {
      if (current.length > 0) {
        blocks.push(current);
      }

      current = [line];
      continue;
    }

    const inlineNumberMatch = line.match(/^(\d{1,2})[.)]?\s+(.+)/);

    if (inlineNumberMatch && getLegalTextScore(inlineNumberMatch[2]) > 0) {
      if (current.length > 0) {
        blocks.push(current);
      }

      current = [inlineNumberMatch[1], inlineNumberMatch[2]];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks
    .map(cleanLegalBlockWithSourceLines)
    .filter((block) => getLegalTextScore(block) > 0)
    .join("\n\n");
}

function cleanLegalBlockWithSourceLines(lines) {
  return mergePdfContinuationLines(lines)
    .map(cleanLegalBlock)
    .filter(Boolean)
    .join("\n");
}

function mergePdfContinuationLines(lines) {
  const merged = [];

  for (const rawLine of lines) {
    const line = String(rawLine).trim();

    if (!line) {
      continue;
    }

    const previous = merged[merged.length - 1];

    if (previous && shouldMergePdfLine(previous, line)) {
      merged[merged.length - 1] = `${previous} ${line}`;
      continue;
    }

    merged.push(line);
  }

  return merged;
}

function shouldMergePdfLine(previous, current) {
  return (
    /\(https?:\/\/[^)]*$/i.test(previous) ||
    /https?:\/\/[^)]*$/i.test(previous) ||
    /=\s*$/i.test(previous) ||
    /^\s*=/.test(current) ||
    (/(?:^|\s)(?:на\s+сайте|сайт)(?:\s+[A-Za-zА-Яа-яЁё0-9_.-]+){0,3}\s*$/iu.test(previous) && /^\(?\s*https?:\/\//i.test(current))
  );
}

function cleanLegalBlock(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+=\s*/g, "=")
    .replace(/=\s+/g, "=")
    .trim();
}

function isFootnoteNumberLine(line) {
  return /^\d{1,2}$/.test(line.trim());
}

function getLegalTextScore(text) {
  const checks = [
    /ОГРН/i,
    /адрес:/i,
    /лицензи/i,
    /Подробнее/i,
    /услов/i,
    /ограничени/i,
    /ПАО/i,
    /ООО/i,
    /НКО/i,
    /рекламодател/i,
    /комисси/i,
    /персональн/i
  ];

  return checks.reduce((score, expression) => score + (expression.test(text) ? 1 : 0), 0);
}

function normalizeParagraphs(input) {
  return input
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map(normalizeLegalParagraph)
    .filter(Boolean);
}

function normalizeLegalParagraph(paragraph) {
  return paragraph
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function renderParagraph(paragraph, rules, phoneRules, templates = state.templates) {
  return splitLegalLines(paragraph)
    .map((line) => renderParagraphLine(line, rules, phoneRules, templates))
    .join("<br>\n");
}

function renderParagraphLine(paragraph, rules, phoneRules, templates = state.templates) {
  const segments = splitMarkdownLinks(paragraph);

  return segments
    .map((segment) => {
      if (segment.type === "link") {
        return renderLegalLink(segment.text, segment.href, templates?.legalLink, rules.linkStyle);
      }

      return renderTextWithPhoneLinks(segment.text, rules, phoneRules, templates);
    })
    .join("");
}

function splitLegalLines(paragraph) {
  return String(paragraph)
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderTextWithPhoneLinks(text, rules, phoneRules, templates = state.templates) {
  const segments = splitSpecialTextSegments(text, rules, phoneRules);

  return segments
    .map((segment) => {
      if (segment.type === "phone") {
        return renderPhoneLink(segment.rule, segment.text, phoneRules);
      }

      if (segment.type === "address") {
        return renderAddressPart(segment.text, templates?.addressPart);
      }

      if (segment.type === "legalLink") {
        return renderLegalLink(segment.text, segment.href, templates?.legalLink, rules.linkStyle) + renderTextSegment(segment.trailingText, rules, true);
      }

      return renderTextSegment(segment.text, rules, true);
    })
    .join("");
}

function parseTemplateFile(templateText) {
  return {
    legalRow: extractTemplateBlock(templateText, "legal-row") || templateText,
    addressPart: extractTemplateBlock(templateText, "address-part"),
    legalLink: extractTemplateBlock(templateText, "legal-link")
  };
}

function extractTemplateBlock(templateText, name) {
  const expression = new RegExp(`<!--\\s*template:${name}:start\\s*-->([\\s\\S]*?)<!--\\s*template:${name}:end\\s*-->`, "i");
  const match = templateText.match(expression);
  return match ? match[1].trim() : "";
}

function splitMarkdownLinks(text) {
  const segments = [];
  const linkPattern = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/gi;
  let cursor = 0;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, match.index) });
    }

    segments.push({ type: "link", text: match[1], href: match[2] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}

function splitPhoneLinks(text, phoneRules) {
  const ranges = collectPhoneRanges(text, phoneRules);

  if (ranges.length === 0) {
    return [{ type: "text", text }];
  }

  const segments = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, range.start) });
    }

    segments.push({
      type: "phone",
      text: text.slice(range.start, range.end),
      rule: range.rule
    });
    cursor = range.end;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}

function splitSpecialTextSegments(text, rules, phoneRules) {
  const ranges = [
    ...collectLegalLinkRanges(text),
    ...collectAddressRanges(text, rules),
    ...collectPhoneRanges(text, phoneRules).map((range) => ({ ...range, type: "phone" }))
  ];

  if (ranges.length === 0) {
    return [{ type: "text", text }];
  }

  const segments = [];
  let cursor = 0;

  for (const range of selectNonOverlappingRanges(ranges)) {
    if (range.start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, range.start) });
    }

    segments.push({
      type: range.type,
      text: range.text || text.slice(range.start, range.end),
      href: range.href || "",
      trailingText: range.trailingText || "",
      rule: range.rule || null
    });
    cursor = range.removeEnd || range.end;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}

function collectLegalLinkRanges(text) {
  const ranges = [];
  const expression = /(^|[^\p{L}\p{N}])((?:на\s+сайте)|сайт)((?:\s+[A-Za-zА-Яа-яЁё0-9_.-]+){0,3})\s*\(\s*(https?:\/\/[^)]+?)\s*\)/giu;
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const trailingText = match[3].replace(/\s+/g, " ").trim();

    ranges.push({
      type: "legalLink",
      start,
      end: start + match[2].length,
      text: match[2].replace(/\s+/g, " "),
      href: normalizeHref(match[4]),
      trailingText: trailingText ? ` ${trailingText}` : "",
      removeEnd: start + match[0].length - match[1].length
    });
  }

  return ranges;
}

function collectPhoneRanges(text, phoneRules) {
  const phones = phoneRules?.phones || [];
  const ranges = [];

  for (const rule of phones) {
    const pattern = String(rule.text || "")
      .trim()
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");

    if (!pattern || !rule.href) {
      continue;
    }

    const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
    let match;

    while ((match = expression.exec(text)) !== null) {
      const start = match.index + match[1].length;
      ranges.push({ start, end: start + match[2].length, rule });
    }
  }

  return ranges
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((accepted, range) => {
      const previous = accepted[accepted.length - 1];

      if (!previous || range.start >= previous.end) {
        accepted.push(range);
      }

      return accepted;
    }, []);
}

function collectAddressRanges(text, rules) {
  const patterns = rules.rules?.addressParts || [];
  const ranges = [];

  for (const rawPattern of patterns) {
    const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${rawPattern})(?=$|\\s|[)])`, "giu");
    let match;

    while ((match = expression.exec(text)) !== null) {
      const start = match.index + match[1].length;
      ranges.push({
        type: "address",
        start,
        end: start + match[2].length
      });
    }
  }

  return ranges;
}

function selectNonOverlappingRanges(ranges) {
  return ranges
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((accepted, range) => {
      const previous = accepted[accepted.length - 1];

      if (!previous || range.start >= previous.end) {
        accepted.push(range);
      }

      return accepted;
    }, []);
}

function renderPhoneLink(rule, text, phoneRules) {
  const attributes = phoneRules?.linkAttributes || {};
  const className = attributes.className || "link";
  const border = attributes.border || "0";
  const style = attributes.style || "";
  const target = attributes.target || "_blank";
  const content = escapeHtml(text).replace(/\s+/g, " ");

  return `<a class="${escapeAttribute(className)}" border="${escapeAttribute(border)}" href="${escapeAttribute(rule.href)}" style="${escapeAttribute(style)}" target="${escapeAttribute(target)}">${content}</a>`;
}

function renderAddressPart(text, template) {
  const content = escapeHtml(text).replace(/\s+/g, " ");

  if (!template) {
    return content;
  }

  return template.replaceAll("{{content}}", content).trim();
}

function renderLegalLink(text, href, template, fallbackStyle = "") {
  const content = escapeHtml(text).replace(/\s+/g, " ");
  const safeHref = escapeAttribute(normalizeHref(href));

  if (!template) {
    return `<a href="${safeHref}" style="${escapeAttribute(fallbackStyle)}" target="_blank">${content}</a>`;
  }

  return template
    .replaceAll("{{href}}", safeHref)
    .replaceAll("{{content}}", content)
    .trim();
}

function renderTextSegment(text, rules, wrapNoBreakGroups) {
  const ranges = collectNoBreakRanges(text, rules);

  if (ranges.length === 0) {
    return escapeHtml(text);
  }

  const mergedRanges = mergeRanges(ranges, text.length);
  let result = "";
  let cursor = 0;

  for (const range of mergedRanges) {
    if (range.start > cursor) {
      result += escapeHtml(text.slice(cursor, range.start));
    }

    const protectedText = escapeHtml(text.slice(range.start, range.end)).replace(/\s+/g, " ");
    result += wrapNoBreakGroups
      ? `<span style="${escapeAttribute(rules.nowrapStyle)}">${protectedText}</span>`
      : protectedText;
    cursor = range.end;
  }

  if (cursor < text.length) {
    result += escapeHtml(text.slice(cursor));
  }

  return result;
}

function collectNoBreakRanges(text, rules) {
  const ranges = [];
  const ruleSet = rules.rules || {};

  collectPhraseRanges(text, ruleSet.phrases || [], ranges);
  collectPrefixRanges(text, ruleSet.prefixWords || [], ranges);
  collectAbbreviationRanges(text, ruleSet.abbreviationBefore || [], ranges);
  collectNumberUnitRanges(text, ruleSet.numberUnits || [], ranges);
  collectDatePrefixRanges(text, ruleSet.datePrefixes || [], ranges);

  if (ruleSet.connectDash) {
    collectDashRanges(text, ranges);
  }

  return ranges;
}

function collectPhraseRanges(text, phrases, ranges) {
  const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);

  for (const phrase of sortedPhrases) {
    const pattern = phrase
      .trim()
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");

    if (!pattern) {
      continue;
    }

    const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
    let match;

    while ((match = expression.exec(text)) !== null) {
      const start = match.index + match[1].length;
      ranges.push({ start, end: start + match[2].length });
    }
  }
}

function collectPrefixRanges(text, prefixes, ranges) {
  if (!prefixes.length) {
    return;
  }

  const prefixPattern = prefixes.map(escapeRegExp).join("|");
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${prefixPattern})(\\s+)([\\p{L}\\p{N}][^\\s,.;:!?)]*)`, "giu");
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length + match[3].length + match[4].length;
    ranges.push({ start, end });
  }
}

function collectAbbreviationRanges(text, abbreviations, ranges) {
  if (!abbreviations.length) {
    return;
  }

  const abbreviationPattern = abbreviations.map(escapeRegExp).join("|");
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${abbreviationPattern})(\\s+)([^\\s,.;:!?)]*)`, "giu");
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length + match[3].length + match[4].length;
    ranges.push({ start, end });
  }
}

function collectNumberUnitRanges(text, units, ranges) {
  if (!units.length) {
    return;
  }

  const unitPattern = units.map(escapeRegExp).join("|");
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])([0-9]+(?:[,.][0-9]+)?)(\\s+)(${unitPattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length + match[3].length + match[4].length;
    ranges.push({ start, end });
  }
}

function collectDatePrefixRanges(text, prefixes, ranges) {
  if (!prefixes.length) {
    return;
  }

  const prefixPattern = prefixes.map(escapeRegExp).join("|");
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${prefixPattern})(\\s+)(\\d{2}\\.\\d{2}\\.\\d{4})(?=$|[^\\p{L}\\p{N}])`, "giu");
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length + match[3].length + match[4].length;
    ranges.push({ start, end });
  }
}

function collectDashRanges(text, ranges) {
  const expression = /(^|\s)([^\s]+)(\s+)([—–])(?=\s|$)/gu;
  let match;

  while ((match = expression.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length + match[3].length + match[4].length;
    ranges.push({ start, end });
  }
}

function mergeRanges(ranges, textLength) {
  return ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, textLength)),
      end: Math.max(0, Math.min(range.end, textLength))
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((merged, range) => {
      const previous = merged[merged.length - 1];

      if (!previous || range.start > previous.end) {
        merged.push({ ...range });
        return merged;
      }

      previous.end = Math.max(previous.end, range.end);
      return merged;
    }, []);
}

function countConfiguredRules(rules) {
  const ruleSet = rules.rules || {};
  return [
    ruleSet.phrases,
    ruleSet.addressParts,
    ruleSet.prefixWords,
    ruleSet.abbreviationBefore,
    ruleSet.numberUnits,
    ruleSet.datePrefixes,
    ruleSet.connectDash ? ["dash"] : []
  ].reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function countPhoneRules(phoneRules) {
  return Array.isArray(phoneRules?.phones) ? phoneRules.phones.length : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("«", "&laquo;")
    .replaceAll("»", "&raquo;")
    .replaceAll("—", "&mdash;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function normalizeHref(value) {
  return String(value)
    .trim()
    .replace(/\s*=\s*/g, "=")
    .replace(/\s+/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function debounce(callback, delay) {
  let timer = null;

  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

async function copyText(text, successMessage) {
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.inset = "0 auto auto 0";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.focus();
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
    setStatus(successMessage);
  }
}
