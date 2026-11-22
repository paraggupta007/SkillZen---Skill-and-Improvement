// PDF rendering adapter for generated interview reports.
import PDFDocument from "pdfkit";
import type { CameraMetrics } from "../camera/camera-repository.js";
import type { Report } from "./report-repository.js";
/** Report document renderer contract. */
export interface IReportPdfRenderer {
  render(
    report: Report,
    camera?: { metrics: CameraMetrics; suggestions: string[] },
  ): Promise<Buffer>;
}
/** Render an in-memory PDF without temporary files. */
export class ReportPdfRenderer implements IReportPdfRenderer {
  /** Render report content using built-in PDF fonts. */
  render(
    report: Report,
    camera?: { metrics: CameraMetrics; suggestions: string[] },
  ): Promise<Buffer> {
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
      if (camera) {
        heading("Optional camera observations");
        const m = camera.metrics;
        doc.text(`Face visible: ${m.faceVisible} of ${m.samples} samples.`, {
          lineGap: 3,
        });
        doc.text(
          m.centeredKnown
            ? `Framing centered: ${m.centered} of ${m.centeredKnown} usable samples.`
            : "Framing: insufficient data.",
          { lineGap: 3 },
        );
        doc.text(
          m.gazeKnown
            ? `Iris position near center: ${m.gazeNearCamera} of ${m.gazeKnown} usable samples.`
            : "Iris position: insufficient data.",
          { lineGap: 3 },
        );
        doc.text(
          m.postureKnown
            ? `Shoulder and hip centers aligned: ${m.postureAligned} of ${m.postureKnown} usable pose samples.`
            : "Body alignment: insufficient data.",
          { lineGap: 3 },
        );
        doc.text(
          m.wristKnown
            ? `Wrist movement: ${m.wristMovements} of ${m.wristKnown} usable samples.`
            : "Wrist movement: insufficient data.",
          { lineGap: 3 },
        );
        doc.text(
          m.handRaisedKnown
            ? `Hand above shoulder: ${m.handRaised} of ${m.handRaisedKnown} usable samples.`
            : "Hand-raise observation: insufficient data.",
          { lineGap: 3 },
        );
        for (const tip of camera.suggestions) doc.text(tip, { lineGap: 3 });
        doc.text(
          "Imperfect self-reported estimates; not a medical assessment or evidence of attention, identity, or cheating. These observations do not affect the score.",
          { lineGap: 3 },
        );
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
