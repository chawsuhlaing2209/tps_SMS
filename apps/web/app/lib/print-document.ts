import "./print-document.css";

export type PrintDocumentOptions = {
  title?: string;
  layout?: "portrait" | "landscape";
  width?: "narrow" | "wide";
  /** Extra selectors removed from the cloned markup (in addition to buttons). */
  removeSelectors?: string[];
};

const DEFAULT_REMOVE_SELECTORS = [
  // Strip interactive controls, but keep buttons that carry printable content
  // (e.g. timetable slot cards) via `data-print-keep`.
  "button:not([data-print-keep])",
  "[data-print-exclude]",
  ".sr-only"
];

/** Print shell styles inlined so the iframe always has layout rules. */
const PRINT_SHELL_CSS = `
.print-document-page {
  background: #fff;
  margin: 0;
  min-height: 100%;
  padding: 24px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-document-root {
  margin: 0 auto;
  width: 100%;
}
.print-document-root--narrow {
  max-width: 520px;
}
.print-document-root--wide {
  max-width: none;
}
@media print {
  @page {
    margin: 14mm;
    size: A4 portrait;
  }
  @page landscape {
    margin: 10mm;
    size: A4 landscape;
  }
  .print-document-page--landscape {
    page: landscape;
  }
  .print-document-page {
    padding: 0;
  }
  .print-document-root--narrow,
  .print-document-root--wide {
    max-width: none;
  }
}
`;

function collectHeadMarkup(): string {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");

  const styles = Array.from(document.querySelectorAll("style"))
    .map((node) => node.outerHTML)
    .join("\n");

  return `${links}\n${styles}`;
}

function prepareClone(source: HTMLElement, removeSelectors: string[]): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;

  for (const selector of removeSelectors) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }

  return clone;
}

function resolveElement(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === "string") {
    return document.querySelector<HTMLElement>(target);
  }
  return target;
}

function waitForStylesheets(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  if (links.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          const sheet = link as HTMLLinkElement;
          if (sheet.sheet) {
            resolve();
            return;
          }
          sheet.addEventListener("load", () => resolve(), { once: true });
          sheet.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function createPrintIframe(): HTMLIFrameElement | null {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.title = "Print preview";
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "none",
    visibility: "hidden"
  });

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document ?? null;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return null;
  }

  return iframe;
}

export function printDocument(
  target: HTMLElement | string,
  options: PrintDocumentOptions = {}
): void {
  const source = resolveElement(target);
  if (!source) {
    const hint =
      typeof target === "string"
        ? `Selector "${target}" did not match any element`
        : "The provided element is not in the document";
    throw new Error(`[printDocument] Cannot print: ${hint}.`);
  }

  const title = options.title ?? document.title;
  const layout = options.layout ?? "portrait";
  const widthClass =
    options.width === "wide" || layout === "landscape"
      ? "print-document-root--wide"
      : "print-document-root--narrow";

  const removeSelectors = [
    ...DEFAULT_REMOVE_SELECTORS,
    ...(options.removeSelectors ?? [])
  ];

  const content = prepareClone(source, removeSelectors);
  const headMarkup = collectHeadMarkup();

  const html = `<!doctype html>
<html lang="${document.documentElement.lang || "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_SHELL_CSS}</style>
  ${headMarkup}
</head>
<body class="print-document-page${layout === "landscape" ? " print-document-page--landscape" : ""}">
  <div class="print-document-root ${widthClass}">
    ${content.outerHTML}
  </div>
</body>
</html>`;

  const iframe = createPrintIframe();
  if (!iframe) {
    throw new Error("[printDocument] Failed to create a print iframe.");
  }

  const frameWindow = iframe.contentWindow!;
  const frameDoc = iframe.contentDocument ?? frameWindow.document;

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
  };

  const runPrint = () => {
    void waitForStylesheets(frameDoc)
      .then(() => frameDoc.fonts.ready)
      .then(() => {
        frameWindow.focus();
        frameWindow.print();
      })
      .catch(() => {
        frameWindow.focus();
        frameWindow.print();
      });
  };

  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  // Some browsers never fire afterprint; avoid leaving a stray iframe.
  window.setTimeout(cleanup, 60_000);

  if (frameDoc.readyState === "complete") {
    requestAnimationFrame(runPrint);
  } else {
    frameWindow.addEventListener("load", runPrint, { once: true });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
