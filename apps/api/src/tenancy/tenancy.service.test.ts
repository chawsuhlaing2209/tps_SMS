import { describe, expect, it } from "vitest";
import { TenancyService } from "./tenancy.service.js";

describe("TenancyService", () => {
  const service = new TenancyService();

  it("resolves explicit tenant slug before host", () => {
    expect(service.resolveSlug({ host: "ignored.example.com", tenantSlug: "demo-school" })).toBe(
      "demo-school"
    );
  });

  it("resolves tenant slug from subdomain", () => {
    expect(service.resolveSlug({ host: "mya-school.example.com" })).toBe("mya-school");
  });

  it("creates tenant-scoped file paths", () => {
    expect(service.tenantFilePath("tenant-1", ["students", "A Mg Mg/photo.png"])).toBe(
      "tenants/tenant-1/students/A-Mg-Mg-photo.png"
    );
  });
});
