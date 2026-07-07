import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { queueNames, type SmsJob } from "@sms/shared";

type RenderPayslipPdfJob = Extract<SmsJob, { name: "render-payslip-pdf" }>["data"];

@Injectable()
export class PayslipQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PayslipQueueService.name);
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  private getQueue(): Queue {
    if (!this.queue) {
      const redisUrl = new URL(this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379");
      this.queue = new Queue(queueNames.documents, {
        connection: {
          host: redisUrl.hostname,
          port: Number(redisUrl.port || 6379),
          username: redisUrl.username || undefined,
          password: redisUrl.password || undefined
        }
      });
    }

    return this.queue;
  }

  async enqueueRenderPayslipPdf(data: RenderPayslipPdfJob): Promise<void> {
    await this.getQueue().add("render-payslip-pdf", data, {
      removeOnComplete: 100,
      removeOnFail: 50
    });
    this.logger.log(
      `Queued render-payslip-pdf tenant=${data.tenantId} record=${data.payrollRecordId}`
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
