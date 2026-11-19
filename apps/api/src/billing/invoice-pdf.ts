import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import { gstStateNames, utgstStateCodes } from "./gst-states.js";

type InvoiceRecord = {
  invoiceNumber: string;
  issuedAt: Date;
  currency: string;
  basePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
  supplierSnapshot: unknown;
  customerSnapshot: unknown;
  order: {
    priceId: string;
    planName: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    targetId: string | null;
  };
};

const ink = "#172e36";
const muted = "#455c64";
const line = "#d6e1df";
const margin = 44;
const gutter = 24;
const fontFile = fileURLToPath(
  new URL("../../assets/fonts/NotoSansDevanagari-Regular.ttf", import.meta.url),
);
const bodyFont = existsSync(fontFile) ? fontFile : "Helvetica";
const formatNumber = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

function snapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
    : "";
}

function stateLabel(party: Record<string, unknown>) {
  const code = text(party.stateCode);
  const state = text(party.stateName) || gstStateNames[code];
  return [state, code ? `State code ${code}` : ""].filter(Boolean).join(" / ");
}

function writeParty(
  doc: PDFKit.PDFDocument,
  label: string,
  party: Record<string, unknown>,
  x: number,
  y: number,
  width: number,
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(muted)
    .text(label, x, y, { width });
  doc
    .font(bodyFont)
    .fontSize(13)
    .fillColor(ink)
    .text(text(party.legalName), x, y + 17, { width, lineGap: 1 });
  const address = [
    party.addressLine1,
    party.addressLine2,
    party.locality,
    party.city,
    party.postalCode,
  ]
    .map(text)
    .filter(Boolean)
    .join(", ");
  const gstin = text(party.gstin);
  const details = [
    address,
    stateLabel(party),
    "India",
    gstin ? "GSTIN " + gstin : "",
    text(party.billingEmail ?? party.email),
    text(party.billingMobile ?? party.phone),
  ]
    .filter(Boolean)
    .join("\n");
  doc
    .font(bodyFont)
    .fontSize(10)
    .fillColor(muted)
    .text(details, x, doc.y + 4, { width, lineGap: 2 });
  return doc.y;
}

function gstRateLabel(taxRate: number | undefined, divisor = 1) {
  return taxRate === undefined ? "" : ` (${taxRate / divisor / 100}%)`;
}

export function renderInvoicePdf(invoice: InvoiceRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const supplier = snapshot(invoice.supplierSnapshot);
    const customer = snapshot(invoice.customerSnapshot);
    const title =
      supplier.testMode === true ? "Test tax invoice" : "Tax invoice";
    const doc = new PDFDocument({
      size: "A4",
      margin,
      info: {
        Title: `${title} ${invoice.invoiceNumber}`,
        Author: "ThePropertyPillar",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);

    const width = doc.page.width - margin * 2;
    const right = margin + width;
    const half = (width - gutter) / 2;
    const amount = (paise: number) =>
      `${invoice.currency} ${formatNumber.format(paise / 100)}`;
    doc.rect(margin, margin, width, 5).fill("#2e6558");
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(ink)
      .text("ThePropertyPillar", margin, margin + 20);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(muted)
      .text("ORIGINAL FOR RECIPIENT", margin, margin + 24, {
        width,
        align: "right",
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .fillColor(ink)
      .text(title, margin, margin + 47);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(invoice.invoiceNumber, margin, margin + 53, {
        width,
        align: "right",
      });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(muted)
      .text(formatDate.format(invoice.issuedAt), margin, margin + 73, {
        width,
        align: "right",
      });

    const partyTop = margin + 118;
    const supplierEnd = writeParty(
      doc,
      "Supplier",
      supplier,
      margin,
      partyTop,
      half,
    );
    const customerEnd = writeParty(
      doc,
      "Bill to",
      customer,
      margin + half + gutter,
      partyTop,
      half,
    );
    let y = Math.max(supplierEnd, customerEnd) + 22;
    doc
      .moveTo(margin, y)
      .lineTo(right, y)
      .lineWidth(0.75)
      .strokeColor(line)
      .stroke();
    doc
      .font(bodyFont)
      .fontSize(10)
      .fillColor(muted)
      .text(
        `Place of supply: ${stateLabel(customer) || "India"}`,
        margin,
        y + 12,
        { width },
      );
    doc.text("Reverse charge: No", margin, doc.y + 2, { width });
    y = doc.y + 20;

    const amountWidth = 129;
    doc.rect(margin, y, width, 30).fill("#edf4f1");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(ink)
      .text("Service", margin + 12, y + 10);
    doc.text("Taxable value", right - amountWidth - 12, y + 10, {
      width: amountWidth,
      align: "right",
    });
    doc
      .font(bodyFont)
      .fontSize(12)
      .text(text(invoice.order.planName), margin + 12, y + 43, {
        width: width - amountWidth - 32,
        lineGap: 1,
      });
    const code = text(supplier.serviceCode ?? supplier.sac);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(muted)
      .text(code ? `SAC ${code}   |   Qty 1` : "Qty 1", margin + 12, doc.y + 4);
    const lineEnd = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(ink)
      .text(amount(invoice.basePaise), right - amountWidth - 12, y + 43, {
        width: amountWidth,
        align: "right",
      });
    y = Math.max(lineEnd, doc.y) + 12;
    doc.moveTo(margin, y).lineTo(right, y).strokeColor(line).stroke();

    const totalWidth = 238;
    const totalsX = right - totalWidth;
    const gstBps =
      typeof supplier.taxRateBps === "number" ? supplier.taxRateBps : undefined;
    const localTax = utgstStateCodes.has(text(supplier.stateCode))
      ? "UTGST"
      : "SGST";
    const taxes: Array<[string, number]> =
      text(supplier.stateCode) === text(customer.stateCode)
        ? [
            [`CGST${gstRateLabel(gstBps, 2)}`, invoice.cgstPaise],
            [`${localTax}${gstRateLabel(gstBps, 2)}`, invoice.sgstPaise],
          ]
        : [[`IGST${gstRateLabel(gstBps)}`, invoice.igstPaise]];
    for (const [label, paise] of [
      ...taxes,
      ["Total GST", invoice.taxPaise] as [string, number],
    ]) {
      y += 19;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(muted)
        .text(label, totalsX + 10, y, { width: totalWidth - amountWidth });
      doc
        .font("Helvetica-Bold")
        .fillColor(ink)
        .text(amount(paise), right - amountWidth - 12, y, {
          width: amountWidth,
          align: "right",
        });
    }
    y += 20;
    doc.rect(totalsX, y, totalWidth, 34).fill(ink);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("white")
      .text("Invoice total", totalsX + 10, y + 11);
    doc.text(amount(invoice.totalPaise), right - amountWidth - 12, y + 11, {
      width: amountWidth,
      align: "right",
    });
    y += 56;

    if (y + 82 > doc.page.height - margin) {
      doc.addPage();
      y = margin;
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(ink)
      .text("Payment reference", margin, y);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(muted)
      .text(
        [
          supplier.testMode === true
            ? "Razorpay test mode"
            : "Paid via Razorpay",
          invoice.order.providerPaymentId
            ? `Payment ${invoice.order.providerPaymentId}`
            : "",
          invoice.order.providerOrderId
            ? `Order ${invoice.order.providerOrderId}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        margin,
        doc.y + 5,
        { width, lineGap: 2 },
      );
    doc.end();
  });
}

export async function streamInvoicePdf(
  response: Response,
  invoice: InvoiceRecord,
): Promise<void> {
  const pdf = await renderInvoicePdf(invoice);
  const filename = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "-");
  response.attachment(`${filename}.pdf`).type("application/pdf").send(pdf);
}
