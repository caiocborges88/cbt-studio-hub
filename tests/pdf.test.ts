import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { openPdf } from "../functions/src/pdf";
describe("PDF extraction without external AI", () => {
  it("preserves textual page order and creates a one-page OCR payload for image-only pages", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    document
      .addPage()
      .drawText("Chapter one: evidence and interpretation.", {
        x: 30,
        y: 700,
        font,
        size: 12,
      });
    document.addPage();
    document
      .addPage()
      .drawText("Chapter three: limitations and conclusions.", {
        x: 30,
        y: 700,
        font,
        size: 12,
      });
    const pdf = await openPdf(await document.save(), 100);
    try {
      expect(pdf.count).toBe(3);
      expect(await pdf.text(1)).toContain("Chapter one");
      expect(await pdf.text(2)).toBe("");
      expect(await pdf.text(3)).toContain("Chapter three");
      const single = await PDFDocument.load(await pdf.pagePdf(2));
      expect(single.getPageCount()).toBe(1);
    } finally {
      await pdf.close();
    }
  }, 15000);
  it("rejects invalid and oversized page counts", async () => {
    await expect(openPdf(new Uint8Array([1, 2, 3]), 100)).rejects.toThrow(
      "inválido",
    );
    const document = await PDFDocument.create();
    document.addPage();
    document.addPage();
    await expect(openPdf(await document.save(), 1)).rejects.toThrow("limite");
  });
});
