import { PDFDocument } from "pdf-lib";
export async function openPdf(bytes: Uint8Array, maxPages: number) {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch {
    throw new Error(
      "PDF inválido ou protegido por senha. Envie uma cópia desbloqueada.",
    );
  }
  if (document.getPageCount() > maxPages)
    throw new Error(
      "O arquivo excede o limite de " +
        maxPages +
        " páginas. Divida em volumes.",
    );
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let parsed;
  try {
    parsed = await getDocument({ data: bytes.slice(), useSystemFonts: true })
      .promise;
  } catch {
    throw new Error("Não foi possível ler este PDF.");
  }
  return {
    count: document.getPageCount(),
    async text(number: number): Promise<string> {
      const page = await parsed.getPage(number);
      const content = await page.getTextContent();
      return content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
    },
    async pagePdf(number: number): Promise<Uint8Array> {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(document, [number - 1]);
      out.addPage(page);
      return out.save();
    },
    async close() {
      await parsed.destroy();
    },
  };
}
