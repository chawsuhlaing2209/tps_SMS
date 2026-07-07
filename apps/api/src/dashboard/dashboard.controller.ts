import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("tenants/:tenantId/dashboard")
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @RequireAnyPermissions(
    "academic_setup.manage",
    "hr.manage",
    "finance.manage",
    "student.manage"
  )
  summary(@Param("tenantId") tenantId: string) {
    return this.dashboardService.getSummary(tenantId);
  }

  @Get("academic-year")
  @RequireAnyPermissions(
    "student.view",
    "student.manage",
    "academic_setup.manage",
    "finance.manage",
    "admissions.manage",
    "classroom.manage",
    "calendar.manage",
    "timetable.manage",
    "exam.manage"
  )
  currentAcademicYear(@Param("tenantId") tenantId: string) {
    return this.dashboardService.getCurrentAcademicYear(tenantId);
  }

  @Get("school-brand")
  // student.view + report.view together cover every tenant role (see rolePermissions).
  @RequireAnyPermissions("student.view", "report.view")
  schoolBrand(@Param("tenantId") tenantId: string) {
    return this.dashboardService.getSchoolBrand(tenantId);
  }

  @Get("home")
  @RequireAnyPermissions(
    "student.view",
    "student.manage",
    "academic_setup.manage",
    "finance.manage",
    "admissions.manage",
    "classroom.manage",
    "calendar.manage",
    "timetable.manage",
    "exam.manage",
    "hr.manage"
  )
  home(@Param("tenantId") tenantId: string) {
    return this.dashboardService.getHome(tenantId);
  }
}
