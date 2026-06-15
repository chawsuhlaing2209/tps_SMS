import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { NotificationsService } from "./notifications.service.js";
import { EmailTemplatesService } from "./email-templates.service.js";
import { NotificationsController } from "./notifications.controller.js";

@Module({
  imports: [DbModule, AuthzModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailTemplatesService],
  exports: [NotificationsService, EmailTemplatesService]
})
export class NotificationsModule {}
