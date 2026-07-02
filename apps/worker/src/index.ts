import { Queue, Worker } from "bullmq";
import { mvpBacklog, queueNames } from "@sms/shared";
import { handleGenerateMonthlyInvoices } from "./generate-monthly-invoices.js";
import { handlePurgeArchivedRecords } from "./purge-archived-records.js";
import { handleRenderPayslipPdf } from "./render-payslip-pdf.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined
};

for (const queueName of Object.values(queueNames)) {
  new Worker(
    queueName,
    async (job) => {
      switch (job.name) {
        case "generate-monthly-invoices": {
          const result = await handleGenerateMonthlyInvoices(job.data);
          console.log("Monthly invoices generated", result);
          break;
        }
        case "send-email-notification":
          console.log("Sending email notification", job.data);
          break;
        case "render-report-card-pdf":
          console.log("Rendering report card PDF", job.data);
          break;
        case "render-payslip-pdf": {
          const result = await handleRenderPayslipPdf(job.data);
          console.log("Payslip PDF rendered", result);
          break;
        }
        case "import-students":
          console.log("Importing students", job.data);
          break;
        case "purge-archived-records": {
          const result = await handlePurgeArchivedRecords();
          console.log("Archive retention purge complete", result);
          break;
        }
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection }
  );
}

// Schedule the daily archive retention purge (idempotent repeatable job).
const maintenanceQueue = new Queue(queueNames.maintenance, { connection });
await maintenanceQueue.add(
  "purge-archived-records",
  {},
  {
    repeat: { pattern: "0 3 * * *" },
    jobId: "purge-archived-records-daily",
    removeOnComplete: true,
    removeOnFail: 100
  }
);

console.log("SMS worker started", {
  queues: Object.values(queueNames),
  backlogItems: mvpBacklog.length
});
