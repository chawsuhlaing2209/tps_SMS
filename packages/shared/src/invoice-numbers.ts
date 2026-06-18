const INVOICE_SUFFIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function formatInvoiceDatePart(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

export function randomInvoiceSuffix(length = 3): string {
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * INVOICE_SUFFIX_CHARS.length);
    suffix += INVOICE_SUFFIX_CHARS[index];
  }
  return suffix;
}

export function buildInvoiceNumber(
  date: Date = new Date(),
  suffix = randomInvoiceSuffix(3)
): string {
  return `INV-${formatInvoiceDatePart(date)}-${suffix}`;
}

export const INVOICE_NUMBER_PATTERN = /^INV-\d{8}-[A-Z0-9]{3}$/;
