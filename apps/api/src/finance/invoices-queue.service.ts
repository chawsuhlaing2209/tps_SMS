import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { queueNames, type SmsJob } from '@sms/shared'

type GenerateMonthlyInvoicesJob = Extract<SmsJob, { name: 'generate-monthly-invoices' }>['data']

@Injectable()
export class InvoicesQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoicesQueueService.name)
  private queue?: Queue

  constructor(private readonly config: ConfigService) {}

  private getQueue(): Queue {
    if (!this.queue) {
      const redisUrl = new URL(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379')
      this.queue = new Queue(queueNames.invoices, {
        connection: {
          host: redisUrl.hostname,
          port: Number(redisUrl.port || 6379),
          username: redisUrl.username || undefined,
          password: redisUrl.password || undefined,
        },
      })
    }

    return this.queue
  }

  async enqueueGenerateMonthlyInvoices(data: GenerateMonthlyInvoicesJob): Promise<void> {
    await this.getQueue().add('generate-monthly-invoices', data, {
      removeOnComplete: 100,
      removeOnFail: 50,
    })
    this.logger.log(
      `Queued generate-monthly-invoices tenant=${data.tenantId} month=${data.billingMonth}`,
    )
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close()
  }
}
