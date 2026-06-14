import { Worker } from "bullmq";
import { mvpBacklog, queueNames } from "@sms/shared";

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
        case "generate-monthly-invoices":
          console.log("Generating monthly invoices", job.data);
          break;
        case "send-email-notification":
          console.log("Sending email notification", job.data);
          break;
        case "render-report-card-pdf":
          console.log("Rendering report card PDF", job.data);
          break;
        case "import-students":
          console.log("Importing students", job.data);
          break;
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection }
  );
}

console.log("SMS worker started", {
  queues: Object.values(queueNames),
  backlogItems: mvpBacklog.length
});
