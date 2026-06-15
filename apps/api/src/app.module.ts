import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AcademicsModule } from "./academics/academics.module.js";
import { AdmissionsModule } from "./admissions/admissions.module.js";
import { AppController } from "./app.controller.js";
import { AttendanceModule } from "./attendance/attendance.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { ClassroomsModule } from "./classrooms/classrooms.module.js";
import { DbModule } from "./db/db.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { HrModule } from "./hr/hr.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { SalaryModule } from "./salary/salary.module.js";
import { StudentsModule } from "./students/students.module.js";
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
    AdmissionsModule,
    ClassroomsModule,
    AttendanceModule,
    AuditModule,
    StudentsModule,
    FinanceModule,
    HrModule,
    SalaryModule
  ],
  controllers: [AppController]
})
export class AppModule {}
