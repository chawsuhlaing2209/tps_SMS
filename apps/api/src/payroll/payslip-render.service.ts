import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  payrollLineItems,
  payrollRecords,
  payrollRuns,
  staff,
  tenantSettings,
  tenants
} from "../db/schema.js";
import { S3StorageService } from "../storage/s3-storage.service.js";

function payslipStorageKey(tenantId: string, recordId: string): string {
  return `tenants/${tenantId}/payroll/payslips/${recordId}.pdf`;
}

function formatMoney(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function renderPdfBuffer(input: {
  tenantName: string;
  schoolContact: string | null;
  staffName: string;
  employeeNumber: string | null;
  departmentName: string | null;
  periodLabel: string;
  baseAmount: string;
  allowancesAmount: string;
  bonusesAmount: string;
  deductionsAmount: string;
  netAmount: string;
  lines: Array<{ label: string; amount: string }>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(input.tenantName, { align: "center" });
    if (input.schoolContact) {
      doc.moveDown(0.25);
      doc.fontSize(9).text(input.schoolContact, { align: "center" });
    }
    doc.moveDown(0.5);
    doc.fontSize(14).text("Payslip", { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Period: ${input.periodLabel}`);
    doc.text(`Employee: ${input.staffName}`);
    if (input.employeeNumber) doc.text(`Employee #: ${input.employeeNumber}`);
    if (input.departmentName) doc.text(`Department: ${input.departmentName}`);
    doc.moveDown();

    doc.fontSize(11).text("Earnings & deductions", { underline: true });
    doc.moveDown(0.5);

    doc.text(`Base salary: ${formatMoney(input.baseAmount)} MMK`);
    for (const line of input.lines) {
      doc.text(`${line.label}: ${formatMoney(line.amount)} MMK`);
    }

    doc.moveDown();
    doc.text(`Allowances: ${formatMoney(input.allowancesAmount)} MMK`);
    doc.text(`Bonuses: ${formatMoney(input.bonusesAmount)} MMK`);
    doc.text(`Deductions: ${formatMoney(input.deductionsAmount)} MMK`);
    doc.moveDown();
    doc.fontSize(12).text(`Net pay: ${formatMoney(input.netAmount)} MMK`, { underline: true });

    doc.end();
  });
}

@Injectable()
export class PayslipRenderService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: S3StorageService
  ) {}

  async ensurePayslip(tenantId: string, recordId: string): Promise<string> {
    const [record] = await this.db
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.id, recordId), eq(payrollRecords.tenantId, tenantId)));

    if (!record) {
      throw new NotFoundException("Payroll record not found.");
    }

    const key = record.payslipStorageKey ?? payslipStorageKey(tenantId, recordId);
    const existing = await this.storage.getObjectIfExists(key);
    if (existing) {
      return key;
    }

    const [run] = await this.db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, record.runId), eq(payrollRuns.tenantId, tenantId)));

    const [staffRow] = await this.db
      .select({
        fullName: staff.fullName,
        employeeNumber: staff.employeeNumber
      })
      .from(staff)
      .where(and(eq(staff.id, record.staffId), eq(staff.tenantId, tenantId)));

    const [tenantRow] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const [settingsRow] = await this.db
      .select({
        schoolName: tenantSettings.schoolName,
        address: tenantSettings.address,
        contactPhone: tenantSettings.contactPhone
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));

    const lines = await this.db
      .select({ label: payrollLineItems.label, amount: payrollLineItems.amount })
      .from(payrollLineItems)
      .where(and(eq(payrollLineItems.recordId, recordId), eq(payrollLineItems.tenantId, tenantId)))
      .orderBy(asc(payrollLineItems.sortOrder));

    const periodLabel = run
      ? `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`
      : "—";

    const pdfBuffer = await renderPdfBuffer({
      tenantName: settingsRow?.schoolName ?? tenantRow?.name ?? "School",
      schoolContact:
        [settingsRow?.address, settingsRow?.contactPhone].filter(Boolean).join(" · ") || null,
      staffName: staffRow?.fullName ?? "Staff",
      employeeNumber: staffRow?.employeeNumber ?? null,
      departmentName: record.departmentName,
      periodLabel,
      baseAmount: record.baseAmount,
      allowancesAmount: record.allowancesAmount,
      bonusesAmount: record.bonusesAmount,
      deductionsAmount: record.deductionsAmount,
      netAmount: record.netAmount,
      lines
    });

    await this.storage.putObject(key, pdfBuffer, "application/pdf");

    await this.db
      .update(payrollRecords)
      .set({
        payslipStorageKey: key,
        payslipGeneratedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(payrollRecords.id, recordId), eq(payrollRecords.tenantId, tenantId)));

    return key;
  }
}
