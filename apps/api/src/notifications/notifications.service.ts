import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { queueNames, type SmsJob } from "@sms/shared";

type EmailJobData = Extract<SmsJob, { name: "send-email-notification" }>["data"];

/**
 * Delivers transactional email through the shared notifications queue. In the
 * `console` provider mode (local development) messages are logged instead of
 * enqueued, so no Redis is required to exercise the flow.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  private get provider(): string {
    return this.config.get<string>("EMAIL_PROVIDER") ?? "console";
  }

  private getQueue(): Queue {
    if (!this.queue) {
      const redisUrl = new URL(this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379");
      this.queue = new Queue(queueNames.notifications, {
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

  async sendEmail(data: EmailJobData): Promise<void> {
    if (this.provider === "console") {
      this.logger.log(
        `[email:${data.templateKey}] to=${data.recipient} ${JSON.stringify(data.variables)}`
      );
      return;
    }

    await this.getQueue().add("send-email-notification", data);
  }

  async sendPasswordResetEmail(input: {
    tenantId: string;
    recipient: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const baseUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";

    await this.sendEmail({
      tenantId: input.tenantId,
      templateKey: "password-reset",
      recipient: input.recipient,
      variables: {
        resetUrl: `${baseUrl}/reset-password?token=${encodeURIComponent(input.token)}`,
        expiresAt: input.expiresAt.toISOString()
      }
    });
  }

  async sendOwnerWelcomeEmail(input: {
    tenantId: string;
    recipient: string;
    schoolName: string;
    tenantSlug: string;
    displayName: string;
    password: string;
  }): Promise<void> {
    const baseUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";

    await this.sendEmail({
      tenantId: input.tenantId,
      templateKey: "owner-welcome",
      recipient: input.recipient,
      variables: {
        schoolName: input.schoolName,
        displayName: input.displayName,
        loginUrl: baseUrl,
        tenantSlug: input.tenantSlug,
        email: input.recipient,
        password: input.password
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
