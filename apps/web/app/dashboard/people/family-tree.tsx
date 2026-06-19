"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "../../../components/shared/empty-state";
import { Icon } from "../../lib/material-icon";

export type FamilyTreeGuardian = {
  id: string;
  fullName: string;
  phone: string | null;
  isPrimary: boolean;
  studentLinks: Array<{ studentId: string; relationship: string }>;
};

export type FamilyTreeStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  dateOfBirth: string | null;
  guardians: Array<{ guardianId: string; relationship: string }>;
};

export function FamilyTree({
  guardians,
  students
}: {
  guardians: FamilyTreeGuardian[];
  students: FamilyTreeStudent[];
}) {
  const t = useTranslations("households");

  const relationshipLabel = (relationship: string) => {
    const key = `relationship_${relationship}` as
      | "relationship_father"
      | "relationship_mother"
      | "relationship_guardian"
      | "relationship_other";
    return t(key);
  };

  if (!guardians.length && !students.length) {
    return <EmptyState compact embedded icon="family_restroom" title={t("treeEmpty")} />;
  }

  return (
    <div className="family-tree" role="img" aria-label={t("treeAria")}>
      {guardians.length > 0 ? (
        <div className="family-tree__level family-tree__level--guardians">
          <p className="pds-type-body-s-regular family-tree__level-label">{t("treeGuardians")}</p>
          <div className="family-tree__nodes">
            {guardians.map((guardian) => (
              <Link
                key={guardian.id}
                href={`/dashboard/people/guardians/${guardian.id}`}
                className={`family-tree-node family-tree-node--guardian${guardian.isPrimary ? " family-tree-node--primary" : ""}`}
              >
                <span className="family-tree-node__icon" aria-hidden>
                  <Icon name="supervisor_account" />
                </span>
                <span className="pds-type-body-m-medium family-tree-node__name">{guardian.fullName}</span>
                {guardian.phone ? (
                  <span className="pds-type-body-s-regular family-tree-node__meta">{guardian.phone}</span>
                ) : null}
                {guardian.isPrimary ? (
                  <span className="pds-type-label-s-medium family-tree-node__badge">{t("primaryGuardian")}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {guardians.length > 0 && students.length > 0 ? (
        <div className="family-tree__connector" aria-hidden>
          <span className="family-tree__stem" />
          <span className="family-tree__rail" />
        </div>
      ) : null}

      {students.length > 0 ? (
        <div className="family-tree__level family-tree__level--students">
          <p className="pds-type-body-s-regular family-tree__level-label">{t("treeStudents")}</p>
          <div className="family-tree__nodes">
            {students.map((student) => (
              <Link
                key={student.id}
                href={`/dashboard/students/${student.id}`}
                className="family-tree-node family-tree-node--student"
              >
                <span className="family-tree-node__icon" aria-hidden>
                  <Icon name="school" />
                </span>
                <span className="pds-type-body-m-medium family-tree-node__name">{student.fullName}</span>
                <span className="pds-type-body-s-regular family-tree-node__meta">
                  {student.admissionNumber} · {student.status}
                </span>
                {student.guardians.length > 0 ? (
                  <span className="pds-type-body-s-regular family-tree-node__meta">
                    {student.guardians.map((link) => relationshipLabel(link.relationship)).join(", ")}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
