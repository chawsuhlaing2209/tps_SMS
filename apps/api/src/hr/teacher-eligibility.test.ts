import { describe, expect, it } from "vitest";
import {
  buildTeacherAssignmentSnapshot,
  isTeacherEligibleForClassroomSubject,
  isTeacherEligibleForHomeroom,
  resolveTeacherCapability
} from "./teacher-eligibility.js";

describe("teacher-eligibility", () => {
  it("requires both subject competency and grade eligibility", () => {
    const capability = {
      competentSubjectIds: ["math-id", "phy-id"],
      eligibleGradeIds: ["g8-id", "g9-id"]
    };

    expect(isTeacherEligibleForClassroomSubject(capability, "g8-id", "math-id")).toBe(true);
    expect(isTeacherEligibleForClassroomSubject(capability, "g12-id", "phy-id")).toBe(false);
    expect(isTeacherEligibleForClassroomSubject(capability, "g8-id", "phy-id")).toBe(true);
    expect(isTeacherEligibleForClassroomSubject(capability, "g12-id", "math-id")).toBe(false);
  });

  it("infers capability from assignments when profile fields are empty", () => {
    const snapshot = buildTeacherAssignmentSnapshot({
      subjectTeaching: [
        { subjectId: "pe-id", gradeId: "g5-id" },
        { subjectId: "pe-id", gradeId: "g6-id" }
      ],
      homeroom: [{ gradeId: "g5-id" }],
      gradeChief: []
    });

    expect(resolveTeacherCapability({}, snapshot)).toEqual({
      competentSubjectIds: ["pe-id"],
      eligibleGradeIds: ["g5-id", "g6-id"]
    });
  });

  it("requires grade eligibility for homeroom assignment", () => {
    const capability = {
      competentSubjectIds: ["eng-id"],
      eligibleGradeIds: ["g12-id"]
    };

    expect(isTeacherEligibleForHomeroom(capability, "g12-id")).toBe(true);
    expect(isTeacherEligibleForHomeroom(capability, "g1-id")).toBe(false);
  });
});
