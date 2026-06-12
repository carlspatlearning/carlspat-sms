import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
import { env } from "../config/env";
import { StudentTermResult } from "./resultService";

export interface ReportCardData {
  school: {
    name: string;
    motto: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string | null;
    headTeacherName: string | null;
  };
  student: {
    fullName: string;
    admissionNo: string;
    gender: string;
    passportUrl: string | null;
    className: string;
  };
  session: string;
  term: string;
  result: StudentTermResult;
  attendance: { present: number; late: number; absent: number; totalDays: number };
  teacherComment: string | null;
  headTeacherComment: string | null;
}

/** HMAC signature used in the QR code so report cards can be verified as authentic. */
export function reportSignature(studentId: string, termId: string): string {
  return crypto
    .createHmac("sha256", env.jwt.accessSecret)
    .update(`${studentId}:${termId}`)
    .digest("hex")
    .slice(0, 24);
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("/")) return null; // local dev path — skip embedding
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const NAVY = "#1e3a5f";
const GOLD = "#b8860b";
const GREY = "#555555";

/** Render a complete A4 report card PDF and return it as a Buffer. */
export async function renderReportCard(data: ReportCardData, verifyUrl: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - 72;
  const [logo, passport, qr] = await Promise.all([
    data.school.logoUrl ? fetchImage(data.school.logoUrl) : null,
    data.student.passportUrl ? fetchImage(data.student.passportUrl) : null,
    QRCode.toBuffer(verifyUrl, { width: 96, margin: 1 }),
  ]);

  // ── Header ──────────────────────────────────────────────────────────────
  if (logo) doc.image(logo, 36, 36, { fit: [64, 64] });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(data.school.name.toUpperCase(), 110, 40, {
    width: pageWidth - 150,
    align: "center",
  });
  doc.fillColor(GOLD).font("Helvetica-Oblique").fontSize(10).text(`"${data.school.motto}"`, 110, doc.y + 2, {
    width: pageWidth - 150,
    align: "center",
  });
  doc.fillColor(GREY).font("Helvetica").fontSize(8).text(data.school.address, 110, doc.y + 2, {
    width: pageWidth - 150,
    align: "center",
  });
  doc.text(`Tel: ${data.school.phone}  ·  Email: ${data.school.email}`, 110, doc.y + 1, {
    width: pageWidth - 150,
    align: "center",
  });
  if (passport) doc.image(passport, doc.page.width - 100, 36, { fit: [64, 64] });
  else doc.rect(doc.page.width - 100, 36, 64, 64).stroke(GREY);

  doc.moveTo(36, 116).lineTo(doc.page.width - 36, 116).lineWidth(2).stroke(NAVY);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(
    `STUDENT REPORT CARD — ${data.term.toUpperCase()}, ${data.session} SESSION`,
    36,
    124,
    { width: pageWidth, align: "center" }
  );

  // ── Student info ─────────────────────────────────────────────────────────
  let y = 150;
  const info: [string, string][] = [
    ["Name", data.student.fullName],
    ["Admission No", data.student.admissionNo],
    ["Class", data.student.className],
    ["Gender", data.student.gender],
    ["Position", data.result.positionLabel ? `${data.result.positionLabel} of ${data.result.classSize}` : "—"],
    ["Average", `${data.result.average}%  (Grade ${data.result.grade} — ${data.result.remark})`],
  ];
  const colWidth = pageWidth / 3;
  info.forEach(([label, value], i) => {
    const x = 36 + (i % 3) * colWidth;
    const rowY = y + Math.floor(i / 3) * 26;
    doc.fillColor(GREY).font("Helvetica").fontSize(7.5).text(label.toUpperCase(), x, rowY);
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(9.5).text(value, x, rowY + 9, { width: colWidth - 8 });
  });
  y += 60;

  // ── Scores table ─────────────────────────────────────────────────────────
  const assessments = data.result.subjects[0]?.scores.map((s) => s.assessment) ?? [];
  const prevTerms = data.result.previousTermNames;
  const headers = [
    "Subject",
    ...assessments.map(abbreviate),
    "Total",
    ...prevTerms.map(abbreviate),
    ...(prevTerms.length > 0 ? ["Cum"] : []),
    "%",
    "Grade",
    "Remark",
  ];
  const subjectColW = 120;
  const remarkColW = 64;
  const otherColW = (pageWidth - subjectColW - remarkColW) / (headers.length - 2);

  const drawRow = (cells: string[], rowY: number, opts: { header?: boolean; zebra?: boolean }) => {
    const h = 18;
    if (opts.header) doc.rect(36, rowY, pageWidth, h).fill(NAVY);
    else if (opts.zebra) doc.rect(36, rowY, pageWidth, h).fill("#f0f4f8");
    let x = 36;
    cells.forEach((cell, i) => {
      const w = i === 0 ? subjectColW : i === cells.length - 1 ? remarkColW : otherColW;
      doc
        .fillColor(opts.header ? "#fff" : "#000")
        .font(opts.header || i === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .text(cell, x + 3, rowY + 5, { width: w - 6, align: i === 0 ? "left" : "center", lineBreak: false });
      x += w;
    });
    return rowY + h;
  };

  y = drawRow(headers, y, { header: true });
  data.result.subjects.forEach((subj, idx) => {
    y = drawRow(
      [
        subj.subject,
        ...subj.scores.map((s) => (s.score === null ? "—" : String(s.score))),
        String(subj.total),
        ...subj.previousTerms.map((p) => (p.total === null ? "—" : String(p.total))),
        ...(prevTerms.length > 0 ? [subj.cumulativeAvg === null ? "—" : String(subj.cumulativeAvg)] : []),
        `${subj.percentage}`,
        subj.grade,
        subj.remark,
      ],
      y,
      { zebra: idx % 2 === 1 }
    );
  });
  doc.rect(36, y, pageWidth, 0.5).fill(NAVY);
  y += 10;

  // ── Attendance + grading key ─────────────────────────────────────────────
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("ATTENDANCE SUMMARY", 36, y);
  doc
    .fillColor("#000")
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `School days: ${data.attendance.totalDays}   Present: ${data.attendance.present}   Late: ${data.attendance.late}   Absent: ${data.attendance.absent}`,
      36,
      y + 13
    );
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("OVERALL", 320, y);
  doc
    .fillColor("#000")
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `Total: ${data.result.overallTotal} / ${data.result.overallMax}   Percentage: ${data.result.average}%` +
        (data.result.cumulativeAverage !== null ? `   Session Average: ${data.result.cumulativeAverage}%` : ""),
      320,
      y + 13
    );
  y += 36;

  // ── Comments ─────────────────────────────────────────────────────────────
  const comment = (title: string, text: string | null, atY: number) => {
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(title, 36, atY);
    doc
      .fillColor("#000")
      .font("Helvetica-Oblique")
      .fontSize(9)
      .text(text || "—", 36, atY + 12, { width: pageWidth - 120 });
    return atY + 40;
  };
  y = comment("CLASS TEACHER'S COMMENT", data.teacherComment, y);
  y = comment(
    `HEAD TEACHER'S COMMENT${data.school.headTeacherName ? ` (${data.school.headTeacherName})` : ""}`,
    data.headTeacherComment,
    y
  );

  // ── Footer: QR, stamp area, signature lines ──────────────────────────────
  const footY = Math.max(y + 6, doc.page.height - 170);
  doc.image(qr, 36, footY, { width: 84 });
  doc.fillColor(GREY).fontSize(6.5).font("Helvetica").text("Scan to verify authenticity", 36, footY + 88, { width: 90 });

  doc.rect(240, footY, 130, 84).dash(3, { space: 2 }).stroke(GREY).undash();
  doc.fillColor(GREY).fontSize(7).text("SCHOOL STAMP", 240, footY + 38, { width: 130, align: "center" });

  doc.moveTo(420, footY + 64).lineTo(556, footY + 64).stroke("#000");
  doc.fillColor("#000").fontSize(8).text("Head Teacher's Signature & Date", 420, footY + 68, { width: 136, align: "center" });

  // Promotion stamp: average ≥ 50% → PROMOTED, below 50% → REPEAT
  if (data.result.promotionDecision) {
    const stamp = data.result.promotionDecision;
    const color = stamp === "PROMOTED" ? "#15803d" : "#b91c1c";
    doc.save();
    doc.translate(468, footY - 26).rotate(-12);
    doc.opacity(0.88);
    doc.lineWidth(2.5).roundedRect(-76, -25, 152, 50, 6).stroke(color);
    doc.lineWidth(1).roundedRect(-69, -19, 138, 38, 4).stroke(color);
    doc
      .fillColor(color)
      .font("Helvetica-Bold")
      .fontSize(stamp === "PROMOTED" ? 19 : 22)
      .text(stamp, -69, stamp === "PROMOTED" ? -8 : -10, { width: 138, align: "center", characterSpacing: 1.5 });
    doc.opacity(1);
    doc.restore();
  }

  doc
    .fillColor(GREY)
    .fontSize(6.5)
    .text(
      `Generated by ${data.school.name} Management System on ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}. This document is invalid without the school stamp.`,
      36,
      doc.page.height - 50,
      { width: pageWidth, align: "center" }
    );

  doc.end();
  return done;
}

function abbreviate(name: string): string {
  const map: Record<string, string> = {
    "First Test": "1st Test",
    "Second Test": "2nd Test",
    "Mid-Term Exam": "Mid-Term",
    "Final Exam": "Exam",
    "First Term": "1st Term",
    "Second Term": "2nd Term",
    "Third Term": "3rd Term",
  };
  return map[name] ?? name;
}

// ── Receipt ──────────────────────────────────────────────────────────────────

export interface ReceiptData {
  school: { name: string; motto: string; address: string; phone: string; email: string };
  receiptNo: string;
  studentName: string;
  admissionNo: string;
  className: string;
  term: string;
  session: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: Date;
  recordedBy: string | null;
  balanceAfter: number;
}

export async function renderReceipt(data: ReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [420, 540], margin: 28 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const w = doc.page.width - 56;

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(data.school.name.toUpperCase(), { align: "center" });
  doc.fillColor(GOLD).font("Helvetica-Oblique").fontSize(8.5).text(`"${data.school.motto}"`, { align: "center" });
  doc.fillColor(GREY).font("Helvetica").fontSize(7).text(data.school.address, { align: "center" });
  doc.text(`Tel: ${data.school.phone} · ${data.school.email}`, { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(28, doc.y).lineTo(doc.page.width - 28, doc.y).lineWidth(1.5).stroke(NAVY);
  doc.moveDown(0.4);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12).text("OFFICIAL FEE RECEIPT", { align: "center" });
  doc.moveDown(0.6);

  const naira = (n: number) => `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const rows: [string, string][] = [
    ["Receipt No", data.receiptNo],
    ["Date", data.paidAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })],
    ["Student", data.studentName],
    ["Admission No", data.admissionNo],
    ["Class", data.className],
    ["Term / Session", `${data.term}, ${data.session}`],
    ["Payment Method", data.method.replace(/_/g, " ")],
    ...(data.reference ? ([["Reference", data.reference]] as [string, string][]) : []),
    ["Amount Paid", naira(data.amount)],
    ["Outstanding Balance", naira(data.balanceAfter)],
    ...(data.recordedBy ? ([["Received By", data.recordedBy]] as [string, string][]) : []),
  ];
  rows.forEach(([label, value], i) => {
    const y = doc.y;
    if (i % 2 === 0) doc.rect(28, y - 2, w, 16).fill("#f0f4f8");
    doc.fillColor(GREY).font("Helvetica").fontSize(8).text(label, 34, y, { lineBreak: false });
    doc
      .fillColor("#000")
      .font(label.startsWith("Amount") ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8.5)
      .text(value, 170, y, { width: w - 150 });
    doc.y = y + 16;
  });

  doc.moveDown(1.2);
  doc.fillColor(data.balanceAfter <= 0 ? "#15803d" : "#b91c1c")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(data.balanceAfter <= 0 ? "✓ FEES FULLY PAID" : "PART PAYMENT — BALANCE OUTSTANDING", { align: "center" });

  doc.moveDown(2);
  doc.moveTo(doc.page.width - 180, doc.y).lineTo(doc.page.width - 28, doc.y).stroke("#000");
  doc.fillColor("#000").font("Helvetica").fontSize(7.5).text("Bursar's Signature", doc.page.width - 180, doc.y + 3, {
    width: 152,
    align: "center",
  });

  doc.end();
  return done;
}
