import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── A4 CONSTANTS (all in mm) ─────────────────────────────────────────────────
const PW = 210; // page width
const PH = 297; // page height
const M = 15; // margin
const CW = PW - M * 2; // content width

// ─── INLINE MARKDOWN STRIPPER ─────────────────────────────────────────────────
// Removes syntax markers while preserving the readable text underneath.

// ─── UNICODE → ASCII SANITIZER ────────────────────────────────────────────────
// jsPDF's built-in helvetica font cannot encode Unicode characters; they render
// as garbled boxes. This function converts common Unicode punctuation to safe
// ASCII equivalents before the text is ever measured or drawn.
const sanitizeText = (str) => {
  if (!str) return str;
  return str
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB]/g, "-") // Unicode bullets → hyphen
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/\u2013|\u2014/g, "-"); // En-dash / Em-dash
};

// ─── LOGO LOADER ──────────────────────────────────────────────────────────────
// Fetches a public-folder image URL and converts it to a Base64 Data URL that
// jsPDF's addImage() can consume. Returns null if the fetch fails so every
// call-site can degrade gracefully without throwing.
const getBase64ImageFromUrl = async (imageUrl) => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("[pdfGenerator] Could not load logo for PDF:", error);
    return null;
  }
};

function stripInline(t) {
  if (!t) return "";
  return sanitizeText(
    t
      .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
      .replace(/__(.*?)__/g, "$1") // __bold__
      .replace(/\*(.*?)\*/g, "$1") // *italic*
      .replace(/_(.*?)_/g, "$1") // _italic_
      .replace(/`([^`]*)`/g, "$1") // `code`
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url)
      .replace(/~~(.*?)~~/g, "$1"), // ~~strikethrough~~
  );
}

// ─── MARKDOWN LINE PARSER ─────────────────────────────────────────────────────
// Converts a raw Markdown string into an array of typed line objects that
// the jsPDF renderer can style and layout without needing to parse again.
//
// Supported types:
//   gap       — blank line (adds vertical whitespace)
//   hr        — horizontal rule (--- or ***)
//   h1        — # or ## headings  → large bold
//   h3        — ### or #### headings → medium bold
//   h5        — ##### or ###### headings → small bold
//   bullet    — * / - / + list item, with optional nesting depth
//   numbered  — 1. 2. 3. list items
//   normal    — paragraph text
function parseLines(markdown) {
  if (!markdown) return [];
  const result = [];

  for (const line of markdown.split("\n")) {
    const t = line.trim();

    // ── Blank line
    if (!t) {
      result.push({ type: "gap" });
      continue;
    }

    // ── Horizontal rule  (--- or ***)
    if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) {
      result.push({ type: "hr" });
      continue;
    }

    // ── ATX Headings  (# through ######)
    const hm = t.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const htype = level <= 2 ? "h1" : level <= 4 ? "h3" : "h5";
      result.push({ type: htype, text: stripInline(hm[2]) });
      continue;
    }

    // ── Nested bullet (2+ leading spaces before the marker)
    const nb = line.match(/^(\s{2,})[*\-+]\s+(.+)/);
    if (nb) {
      const depth = Math.floor(nb[1].length / 2);
      result.push({ type: "bullet", text: stripInline(nb[2]), depth });
      continue;
    }

    // ── Top-level bullet
    const b = t.match(/^[*\-+]\s+(.+)/);
    if (b) {
      result.push({ type: "bullet", text: stripInline(b[1]), depth: 0 });
      continue;
    }

    // ── Numbered list item
    const n = t.match(/^(\d+)\.\s+(.+)/);
    if (n) {
      result.push({
        type: "numbered",
        text: `${n[1]}. ${stripInline(n[2])}`,
      });
      continue;
    }

    // ── A line that is entirely bold text → treat as a sub-heading (h5)
    if (/^\*\*[^*]+\*\*:?$/.test(t)) {
      result.push({ type: "h5", text: stripInline(t) });
      continue;
    }

    // ── Normal paragraph
    result.push({ type: "normal", text: stripInline(t) });
  }

  return result;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
/**
 * Generates and downloads a professional A4 PDF.
 *
 * @param {object}   options
 * @param {string}   options.chartElementId   DOM id of the chart wrapper to screenshot
 * @param {string}   options.reportText        Raw Markdown string from the AI
 * @param {string}   options.timeframeLabel    Human-readable timeframe e.g. "Yearly Average"
 * @param {string}   options.primaryYear       e.g. "2025"
 * @param {string}   [options.compareYear]     e.g. "2024" or "none" / falsy
 * @param {string[]} [options.metrics]         Array of metric names
 * @param {string}   [options.savedBase64Image]  Optional pre-captured base64 PNG (used for history exports to avoid live DOM scraping)
 */
export async function exportReportToPDF({
  chartElementId,
  reportText,
  timeframeLabel,
  primaryYear,
  compareYear,
  metrics = [],
  savedBase64Image,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isYoY = compareYear && compareYear !== "none";
  let y = M; // live cursor — advances as content is placed

  // Fetch the corporate logo once up front; null if the asset is unavailable.
  const logoBase64 = await getBase64ImageFromUrl("/logo192.png");

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** Break to a new page and reset the cursor, adding a "continued" line. */
  const addPage = () => {
    doc.addPage();
    // Draw the continuation label at a fixed position near the top of the page.
    const contY = M + 5; // 20 mm from the top edge
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text("K2MAC Logistics — KPI Report (continued)", M, contY);
    // Restore body style and leave generous breathing room below the label
    // before the main rendering loop places its first element.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(52, 73, 94);
    y = contY + 12; // 12 mm gap → body content starts at ~32 mm
  };

  /** Adds a new page if `needed` mm won't fit on the current page. */
  const ensureSpace = (needed) => {
    if (y + needed > PH - M - 12) addPage();
  };

  // ── 1. HEADER: LOGO + BRAND NAME ────────────────────────────────────────────
  // White page background — no filled rectangle. The logo and wordmark carry
  // the brand on their own. A thin accent rule below the block keeps the layout
  // grounded without the visual weight of a solid bar.

  // Determine where header text starts: shift right when the logo is present.
  let headerTextX = M;
  if (logoBase64) {
    // Logo: x=14, y=10 → 16×16 mm block, bottom edge at y=26.
    doc.addImage(logoBase64, "PNG", 14, 10, 16, 16);
    headerTextX = 34; // 14 mm logo x-start + 16 mm width + 4 mm gap
  }

  // Primary brand name — charcoal, large.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text("K2MAC Logistics", headerTextX, 18);

  // Tagline / document type — mid-gray, smaller.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("AI KPI Executive Report", headerTextX, 24);

  // Thin accent rule separating the header block from the body.
  doc.setDrawColor(233, 117, 18); // #E97512
  doc.setLineWidth(0.5);
  doc.line(M, 30, PW - M, 30);

  y = 38; // Body content starts comfortably below the header block.

  // ── 2. REPORT TITLE ─────────────────────────────────────────────────────────
  const title = isYoY
    ? `Year-over-Year Analysis: ${primaryYear} vs ${compareYear}`
    : `KPI Performance Report: ${primaryYear}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(26, 32, 44);
  doc.text(title, M, y);
  y += 9;

  // ── 3. SUB-HEADER META (timeframe / metrics / date) ─────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);

  doc.text(`Timeframe: ${timeframeLabel || primaryYear}`, M, y);
  y += 5;

  if (metrics.length > 0) {
    doc.text(`Metrics Analyzed: ${metrics.join(", ")}`, M, y);
    y += 5;
  }

  const generatedOn = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated: ${generatedOn}`, M, y);
  y += 2;

  // ── 4. DIVIDER ──────────────────────────────────────────────────────────────
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(M, y + 3, PW - M, y + 3);
  y += 10;

  // ── 5. CHART IMAGE (saved snapshot OR live html2canvas) ─────────────────────
  // If a pre-captured base64 image was passed in (e.g., from a history export)
  // use it directly — no DOM dependency, works even when the chart shows a
  // different year. Otherwise fall back to a live html2canvas capture.
  let chartImgData = savedBase64Image || null;

  if (!chartImgData) {
    const chartEl = chartElementId
      ? document.getElementById(chartElementId)
      : null;

    if (chartEl) {
      chartEl.classList.add("pdf-export-mode");
      try {
        const canvas = await html2canvas(chartEl, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          imageTimeout: 0,
          logging: false,
        });
        chartImgData = canvas.toDataURL("image/png");
      } catch (err) {
        console.warn("[pdfGenerator] Chart capture failed, skipping:", err);
      } finally {
        chartEl.classList.remove("pdf-export-mode");
      }
    }
  }

  if (chartImgData) {
    try {
      const imgProps = doc.getImageProperties(chartImgData);
      const imgH = (imgProps.height / imgProps.width) * CW;
      ensureSpace(imgH + 5);
      doc.addImage(chartImgData, "PNG", M, y, CW, imgH);
      y += imgH + 6;
    } catch (err) {
      console.warn("[pdfGenerator] Failed to embed chart image:", err);
    }
  }

  // ── 6. SECTION HEADER FOR AI TEXT ───────────────────────────────────────────
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(M, y, PW - M, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(233, 117, 18); // #E97512
  doc.text("AI-Generated Analysis", M, y);
  y += 8;

  // ── 7. RENDER PARSED MARKDOWN LINES ─────────────────────────────────────────
  const LH = 5; // standard line height in mm
  const GAP = 2; // vertical space for blank lines

  for (const line of parseLines(reportText)) {
    switch (line.type) {
      // ── blank line
      case "gap":
        y += GAP;
        break;

      // ── horizontal rule
      case "hr": {
        ensureSpace(5);
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.3);
        doc.line(M, y, PW - M, y);
        y += 5;
        break;
      }

      // ── h1/h2  (large bold)
      // "Keep with next": reserve heading height + 20 mm so a heading is never
      // stranded at the foot of a page without at least 2-3 lines beneath it.
      case "h1": {
        ensureSpace(16 + 20);
        y += 3; // extra breathing room above main headings
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(26, 32, 44);
        const wrapped = doc.splitTextToSize(line.text, CW);
        doc.text(wrapped, M, y);
        y += wrapped.length * 6.5 + 3;
        break;
      }

      // ── h3/h4  (medium bold)
      case "h3": {
        ensureSpace(12 + 20); // keep-with-next buffer
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(26, 32, 44);
        const wrapped = doc.splitTextToSize(line.text, CW);
        doc.text(wrapped, M, y);
        y += wrapped.length * 5.5 + 2;
        break;
      }

      // ── h5/h6 and bold-only lines  (small bold)
      case "h5": {
        ensureSpace(9 + 20); // keep-with-next buffer
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(55, 65, 81);
        const wrapped = doc.splitTextToSize(line.text, CW);
        doc.text(wrapped, M, y);
        y += wrapped.length * 5 + 2;
        break;
      }

      // ── bullet point (supports nesting depth)
      case "bullet": {
        const depth = line.depth || 0;
        const xLeft = M + 4 + depth * 6; // indent per level
        const marker = depth === 0 ? "-  " : "o  "; // ASCII-safe: hyphen or 'o'
        const maxW = CW - 4 - depth * 6;
        const fullText = marker + line.text;
        const wrapped = doc.splitTextToSize(fullText, maxW);
        const bh = wrapped.length * LH;

        ensureSpace(bh + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(52, 73, 94);
        doc.text(wrapped, xLeft, y);
        y += bh + 1.5;
        break;
      }

      // ── numbered list item
      case "numbered": {
        const wrapped = doc.splitTextToSize(line.text, CW - 6);
        const bh = wrapped.length * LH;

        ensureSpace(bh + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(52, 73, 94);
        doc.text(wrapped, M + 5, y);
        y += bh + 1.5;
        break;
      }

      // ── normal paragraph
      case "normal":
      default: {
        const wrapped = doc.splitTextToSize(line.text, CW);
        const bh = wrapped.length * LH;

        ensureSpace(bh + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(52, 73, 94);
        doc.text(wrapped, M, y);
        y += bh + 2;
        break;
      }
    }
  }

  // ── 8. FOOTER ON EVERY PAGE ──────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 13, PW - M, PH - 13);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `K2MAC Logistics  ·  Confidential  ·  Page ${i} of ${totalPages}`,
      PW / 2,
      PH - 8,
      { align: "center" },
    );
  }

  // ── 9. TRIGGER DOWNLOAD ──────────────────────────────────────────────────────
  const yearPart = isYoY
    ? `${primaryYear}_vs_${compareYear}`
    : String(primaryYear);
  const datePart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  doc.save(`KPI_Report_${yearPart}_${datePart}.pdf`);
}
