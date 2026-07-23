import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AcademicsModule } from "./academics/academics.module.js";
import { AdmissionsModule } from "./admissions/admissions.module.js";
import { AppController } from "./app.controller.js";
import { ArchiveModule } from "./archive/archive.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { ClassroomsModule } from "./classrooms/classrooms.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DbModule } from "./db/db.module.js";
import { DepartmentsModule } from "./departments/departments.module.js";
import { FacilitiesModule } from "./facilities/facilities.module.js";
import { DiscountsModule } from "./discounts/discounts.module.js";
import { EnrollmentsModule } from "./enrollments/enrollments.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { HrModule } from "./hr/hr.module.js";
import { LeavesModule } from "./leaves/leaves.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { PayrollModule } from "./payroll/payroll.module.js";
import { SalaryModule } from "./salary/salary.module.js";
import { SchoolProfileModule } from "./school-profile/school-profile.module.js";
import { SchoolScheduleModule } from "./school-schedule/school-schedule.module.js";
import { StudentsModule } from "./students/students.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { TimetableModule } from "./timetable/timetable.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the API's own .env first, then fall back to the repo-root .env so
      // the app works whether it is started from apps/api or the workspace root.
      envFilePath: [".env", "../../.env"]
    }),
    // Rate-limit buckets for credential endpoints (login, activate, password
    // reset). Guards are applied per-route, not globally, so normal app
    // traffic is never throttled. In-memory storage: limits are per-instance.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "credentials", ttl: 60_000, limit: 10 }]
    }),
    DbModule,
    StorageModule,
    DashboardModule,
    TenancyModule,
    IdentityModule,
    AcademicsModule,
    AdmissionsModule,
    ClassroomsModule,
    AuditModule,
    ArchiveModule,
    StudentsModule,
    FinanceModule,
    HrModule,
    LeavesModule,
    DepartmentsModule,
    FacilitiesModule,
    SalaryModule,
    PayrollModule,
    SchoolProfileModule,
    SchoolScheduleModule,
    DiscountsModule,
    TimetableModule,
    EnrollmentsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
