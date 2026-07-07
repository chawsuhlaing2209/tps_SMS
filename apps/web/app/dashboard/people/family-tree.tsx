"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "../../../components/shared/badge";
import { Chip } from "../../../components/shared/chip";
import { EmptyState } from "../../../components/shared/empty-state";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { TrailLink } from "../../../components/shared/trail-link";
import { deriveInitials } from "../../lib/data-table";
import { subjectColor } from "../structure/subject-colors";

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

function NodeAvatar({ name }: { name: string }) {
  const swatch = subjectColor(name);
  return (
    <span
      className="pds-type-title-xs-bold directory-avatar"
      style={{ background: swatch.bg, color: swatch.text }}
      aria-hidden
    >
      {deriveInitials(name)}
    </span>
  );
}

/** Canvas-style family tree: guardians on top, connector rails, students below. */
export function FamilyTree({
  guardians,
  students,
  from,
  canManage = false,
  onRemoveStudent
}: {
  guardians: FamilyTreeGuardian[];
  students: FamilyTreeStudent[];
  /** Trail origin (household page) so back links return here. */
  from: { label: string; href: string };
  canManage?: boolean;
  onRemoveStudent?: (student: FamilyTreeStudent) => void;
}) {
  const t = useTranslations("households");
  const s = useTranslations("students");
  const c = useTranslations("common");

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

  const connected = guardians.length > 0 && students.length > 0;

  return (
    <div className="ftree-canvas">
      <div className="ftree">
        {guardians.length > 0 ? (
          <div className={`ftree__guardians${connected ? " ftree__guardians--connected" : ""}`}>
            {guardians.map((guardian) => {
              // Only claim a blanket relationship when it is the same for every
              // linked student; mixed cases are spelled out on the student cards.
              const uniqueRelationships = [
                ...new Set(guardian.studentLinks.map((link) => link.relationship))
              ];
              const relationships =
                uniqueRelationships.length === 1
                  ? [relationshipLabel(uniqueRelationships[0]!)]
                  : [];
              return (
                <article
                  key={guardian.id}
                  className={`ftree-card${guardian.isPrimary ? " ftree-card--primary" : ""}`}
                >
                  <TrailLink
                    href={`/dashboard/people/guardians/${guardian.id}`}
                    className="ftree-card__link"
                    from={from}
                  >
                    <NodeAvatar name={guardian.fullName} />
                    <span className="pds-type-body-m-bold ftree-card__name">{guardian.fullName}</span>
                    {guardian.phone ? (
                      <span className="pds-type-body-s-regular ftree-card__meta">{guardian.phone}</span>
                    ) : null}
                  </TrailLink>
                  <span className="ftree-card__tags">
                    {relationships.map((label) => (
                      <Chip key={label}>{label}</Chip>
                    ))}
                    {guardian.isPrimary ? <Chip>{t("primaryGuardian")}</Chip> : null}
                  </span>
                </article>
              );
            })}
          </div>
        ) : null}

        {students.length > 0 ? (
          <div className="ftree__students">
            {students.map((student) => {
              // Spell out each guardian link when relationships could be
              // ambiguous: several guardians, or a guardian whose relationship
              // differs per student.
              const showLinks =
                guardians.length > 1 ||
                guardians.some(
                  (guardian) =>
                    new Set(guardian.studentLinks.map((link) => link.relationship)).size > 1
                );
              return (
              <div key={student.id} className={connected ? "ftree__branch" : "ftree__branch ftree__branch--loose"}>
                <article className="ftree-card">
                  <TrailLink
                    href={`/dashboard/students/${student.id}`}
                    className="ftree-card__link"
                    from={from}
                  >
                    <NodeAvatar name={student.fullName} />
                    <span className="pds-type-body-m-bold ftree-card__name">{student.fullName}</span>
                    <span className="pds-type-body-s-regular ftree-card__meta">
                      {student.admissionNumber}
                    </span>
                    {showLinks
                      ? student.guardians.map((link) => {
                          const guardian = guardians.find((g) => g.id === link.guardianId);
                          if (!guardian) return null;
                          return (
                            <span
                              key={link.guardianId}
                              className="pds-type-body-s-regular ftree-card__meta"
                            >
                              {relationshipLabel(link.relationship)} · {guardian.fullName}
                            </span>
                          );
                        })
                      : null}
                  </TrailLink>
                  <span className="ftree-card__tags">
                    <StatusBadge
                      status={student.status}
                      label={s(`status_${student.status}` as "status_draft")}
                    />
                  </span>
                  {canManage && onRemoveStudent ? (
                    <span className="ftree-card__menu">
                      <RowMoreActionsMenu
                        ariaLabel={c("moreActions")}
                        items={[
                          {
                            id: "remove",
                            label: t("removeStudentConfirm"),
                            icon: "person_remove",
                            destructive: true,
                            onSelect: () => onRemoveStudent(student)
                          }
                        ]}
                      />
                    </span>
                  ) : null}
                </article>
              </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
