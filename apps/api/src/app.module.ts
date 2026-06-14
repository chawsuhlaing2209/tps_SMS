import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AcademicsModule } from "./academics/academics.module.js";
import { AppController } from "./app.controller.js";
import { AttendanceModule } from "./attendance/attendance.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { ClassroomsModule } from "./classrooms/classrooms.module.js";
import { DbModule } from "./db/db.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the API's own .env first, then fall back to the repo-root .env so
      // the app works whether it is started from apps/api or the workspace root.
      envFilePath: [".env", "../../.env"]
    }),
    DbModule,
    TenancyModule,
    IdentityModule,
    AcademicsModule,
    ClassroomsModule,
    AttendanceModule,
    AuditModule
  ],
  controllers: [AppController]
})
export class AppModule {}
