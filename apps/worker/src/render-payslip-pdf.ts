import PDFDocument from "pdfkit";
import pg from "pg";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { SmsJob } from "@sms/shared";

type RenderPayslipPdfJob = Extract<SmsJob, { name: "render-payslip-pdf" }>["data"];

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minio",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minio-password"
    }
  });
}

function payslipStorageKey(tenantId: string, recordId: string): string {
  return `tenants/${tenantId}/payroll/payslips/${recordId}.pdf`;
}

function formatMoney(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function renderPdfBuffer(input: {
  tenantName: string;
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

export async function handleRenderPayslipPdf(data: RenderPayslipPdfJob) {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://sms:sms@localhost:5432/sms";
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const recordResult = await client.query(
      `SELECT pr.*, s.full_name, s.employee_number, prun.period_year, prun.period_month
       FROM payroll_records pr
       JOIN staff s ON s.id = pr.staff_id AND s.tenant_id = pr.tenant_id
       JOIN payroll_runs prun ON prun.id = pr.run_id AND prun.tenant_id = pr.tenant_id
       WHERE pr.id = $1 AND pr.tenant_id = $2`,
      [data.payrollRecordId, data.tenantId]
    );

    if (recordResult.rowCount === 0) {
      throw new Error(`Payroll record not found: ${data.payrollRecordId}`);
    }

    const record = recordResult.rows[0] as {
      id: string;
      tenant_id: string;
      department_name: string | null;
      base_amount: string;
      allowances_amount: string;
      bonuses_amount: string;
      deductions_amount: string;
      net_amount: string;
      full_name: string;
      employee_number: string | null;
      period_year: number;
      period_month: number;
    };

    const tenantResult = await client.query(`SELECT name FROM tenants WHERE id = $1`, [
      data.tenantId
    ]);
    const tenantName = (tenantResult.rows[0] as { name: string } | undefined)?.name ?? "School";

    const linesResult = await client.query(
      `SELECT label, amount FROM payroll_line_items
       WHERE record_id = $1 AND tenant_id = $2
       ORDER BY sort_order ASC`,
      [data.payrollRecordId, data.tenantId]
    );

    const periodLabel = `${record.period_year}-${String(record.period_month).padStart(2, "0")}`;
    const pdfBuffer = await renderPdfBuffer({
      tenantName,
      staffName: record.full_name,
      employeeNumber: record.employee_number,
      departmentName: record.department_name,
      periodLabel,
      baseAmount: record.base_amount,
      allowancesAmount: record.allowances_amount,
      bonusesAmount: record.bonuses_amount,
      deductionsAmount: record.deductions_amount,
      netAmount: record.net_amount,
      lines: linesResult.rows as Array<{ label: string; amount: string }>
    });

    const storageKey = payslipStorageKey(data.tenantId, data.payrollRecordId);
    const bucket = process.env.S3_BUCKET ?? "sms-local";
    const s3 = getS3Client();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: pdfBuffer,
        ContentType: "application/pdf"
      })
    );

    await client.query(
      `UPDATE payroll_records
       SET payslip_storage_key = $1, payslip_generated_at = now(), updated_at = now()
       WHERE id = $2 AND tenant_id = $3`,
      [storageKey, data.payrollRecordId, data.tenantId]
    );

    return { storageKey, bytes: pdfBuffer.length };
  } finally {
    await client.end();
  }
}

export async function verifyPayslipExists(storageKey: string): Promise<boolean> {
  const bucket = process.env.S3_BUCKET ?? "sms-local";
  const s3 = getS3Client();
  try {
    await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
}
