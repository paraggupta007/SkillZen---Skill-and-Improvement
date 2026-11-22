// PDF rendering adapter for generated interview reports.
import PDFDocument from "pdfkit";
import type { Report } from "./report-repository.js";
/** Report document renderer contract. */
export interface IReportPdfRenderer {
  render(report: Report): Promise<Buffer>;
}
/** Render an in-memory PDF without temporary files. */
export class ReportPdfRenderer implements IReportPdfRenderer {
  /** Render report content using built-in PDF fonts. */
  render(report: Report): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: { Title: "SkillZen interview report" },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc
        .fillColor("#28543b")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("SkillZen");
      doc
        .moveDown(0.35)
        .fillColor("#203b30")
        .fontSize(18)
        .text("Interview report");
      doc
        .moveDown(0.5)
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#50685a")
        .text(`Overall score: ${report.overallScore} / 10`);
      doc.moveDown();
      const heading = (value: string) => {
        doc
          .moveDown(0.6)
          .fillColor("#28543b")
          .font("Helvetica-Bold")
          .fontSize(14)
          .text(value);
        doc.moveDown(0.3).font("Helvetica").fontSize(11).fillColor("#263c30");
      };
      heading("Summary");
      doc.text(report.summary, { lineGap: 3 });
      for (const [title, items] of [
        ["Strengths", report.strengths],
        ["Areas to improve", report.weaknesses],
        ["Next steps", report.tips],
      ] as const) {
        heading(title);
        for (const item of items)
          doc.text(`• ${item}`, { lineGap: 3, paragraphGap: 6 });
      }
      doc
        .moveDown()
        .fontSize(9)
        .fillColor("#728477")
        .text("AI feedback is a practice aid, not a hiring decision.");
      doc.end();
    });
  }
}
