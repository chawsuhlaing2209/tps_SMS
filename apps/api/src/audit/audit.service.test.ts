import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditService } from "./audit.service.js";
import type { Database } from "../db/db.module.js";

describe("AuditService", () => {
  const service = new AuditService({} as Database);

  it("captures attendance correction before and after values", () => {
    const event = service.createAttendanceCorrectionEvent({
      tenantId: "6e48e417-8a79-4f8e-9cfe-8a7171b0566a",
      actorUserId: "c76553f7-c68b-4c49-8b8f-a520d7169991",
      attendanceRecordId: "attendance-1",
      previousStatus: "late",
      nextStatus: "present",
      reason: "Teacher corrected late arrival after office verification."
    });

    expect(event.action).toBe("attendance.correct");
    expect(event.before).toEqual({ status: "late" });
    expect(event.after).toEqual({ status: "present" });
    expect(event.reason).toContain("office verification");
  });

  it("rejects sensitive corrections without a reason", () => {
    expect(() =>
      service.createSensitiveCorrectionEvent({
        tenantId: "6e48e417-8a79-4f8e-9cfe-8a7171b0566a",
        actorUserId: "c76553f7-c68b-4c49-8b8f-a520d7169991",
        action: "payment.verify",
        recordType: "payment",
        recordId: "payment-1",
        reason: "   "
      })
    ).toThrow(BadRequestException);
  });
});
