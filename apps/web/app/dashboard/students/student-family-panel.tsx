"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { PanelMoreActionsMenu } from "../../lib/hero-more-actions";
import { DataTableSection, TablePanelBody } from "../../lib/table-panel";
import { EntityAvatar, RadioBox } from "../../../components/pds";
import { Badge, StatusBadge } from "../../../components/shared/badge";
import { EmptyState } from "../../../components/shared/empty-state";
import { TableSearchInput } from "../../lib/table-search";

type FamilyMember = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
};

type FamilyGroupDetail = {
  id: string;
  name: string;
  primaryGuardian: { id: string; fullName: string; phone: string | null } | null;
  members: FamilyMember[];
};

type FamilyGroupSearchResult = {
  id: string;
  name: string;
  primaryGuardianName: string | null;
  memberCount: number;
  members: FamilyMember[];
};

type LinkedGuardian = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  relationship: string;
};

const ENROLLED_STATUSES = new Set(["draft", "enrolled", "transferred"]);

function personInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
}

export function StudentFamilyPanel({
  studentId,
  familyGroupId,
  hasGuardian,
  guardians = [],
  primaryGuardian,
  canManage,
  onUpdated,
  sectionTitle,
  variant = "section"
}: {
  studentId: string;
  familyGroupId: string | null | undefined;
  hasGuardian: boolean;
  guardians?: LinkedGuardian[];
  primaryGuardian?: { id: string; fullName: string } | null;
  canManage: boolean;
  onUpdated: () => void;
  sectionTitle: string;
  variant?: "section" | "tab";
}) {
  const t = useTranslations("students");
  const c = useTranslations("common");
  const [joinOpen, setJoinOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const family = useApiQuery<FamilyGroupDetail>((tenant) =>
    familyGroupId ? `/tenants/${tenant}/family-groups/${familyGroupId}` : null
  );

  const searchResults = useApiQuery<{ data: FamilyGroupSearchResult[] }>((tenant) =>
    debouncedSearch.length >= 2
      ? `/tenants/${tenant}/family-groups?search=${encodeURIComponent(debouncedSearch)}`
      : null
  );

  const createFamily = useApiMutation<{ name?: string }, FamilyGroupDetail>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/family-group`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students/${studentId}/profile`,
        `/tenants/${tenant}/family-groups`
      ]
    }
  );

  const setFamilyGroup = useApiMutation<{ familyGroupId: string | null }, unknown>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/family-group`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students/${studentId}/profile`,
        `/tenants/${tenant}/family-groups`
      ]
    }
  );

  const siblings =
    family.data?.members.filter((member) => member.id !== studentId) ?? [];

  const handleCreateFamily = async () => {
    setFormError(null);
    try {
      await createFamily.mutateAsync({});
      onUpdated();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const handleJoinFamily = async () => {
    setFormError(null);
    if (!selectedFamilyId) {
      setFormError(t("selectFamilyRequired"));
      return;
    }
    try {
      await setFamilyGroup.mutateAsync({ familyGroupId: selectedFamilyId });
      setJoinOpen(false);
      setSearch("");
      setSelectedFamilyId("");
      onUpdated();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const handleRemoveFromFamily = async () => {
    setFormError(null);
    try {
      await setFamilyGroup.mutateAsync({ familyGroupId: null });
      onUpdated();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const busy = createFamily.isPending || setFamilyGroup.isPending;

  const relationshipLabel = (relationship: string) => {
    const labels: Record<string, string> = {
      father: t("relationshipFather"),
      mother: t("relationshipMother"),
      guardian: t("relationshipGuardian"),
      other: t("relationshipOther")
    };
    return labels[relationship] ?? relationship;
  };

  const manageActions = (
    <>
      {canManage && !familyGroupId ? (
        <>
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={!hasGuardian || busy}
            onClick={() => void handleCreateFamily()}
          >
            <Icon name="group_add" />
            {createFamily.isPending ? c("loading") : t("createFamily")}
          </button>
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
            disabled={busy}
            onClick={() => {
              setFormError(null);
              setJoinOpen(true);
            }}
          >
            <Icon name="link" />
            {t("joinFamily")}
          </button>
        </>
      ) : canManage && familyGroupId ? (
        <PanelMoreActionsMenu
          label={t("moreActions")}
          items={[
            {
              id: "change",
              label: t("changeFamily"),
              icon: "swap_horiz",
              disabled: busy,
              onSelect: () => {
                setFormError(null);
                setJoinOpen(true);
              }
            },
            {
              id: "remove",
              label: t("removeFromFamily"),
              icon: "link_off",
              destructive: true,
              disabled: busy,
              onSelect: () => void handleRemoveFromFamily()
            }
          ]}
        />
      ) : null}
    </>
  );

  const primaryGuardianId =
    primaryGuardian?.id ?? family.data?.primaryGuardian?.id ?? null;
  const primaryGuardianName =
    primaryGuardian?.fullName ?? family.data?.primaryGuardian?.fullName ?? null;

  const guardianMemberCards =
    guardians.length > 0 ? (
      guardians.map((guardian) => (
        <li key={guardian.id} className="student-family-panel__card">
          <EntityAvatar
            initials={personInitials(guardian.fullName)}
            nameForColor={guardian.fullName}
            className="student-family-panel__avatar"
          />
          <div className="student-family-panel__card-main">
            <Link
              href={`/dashboard/people/guardians/${guardian.id}`}
              className="pds-type-body-m-bold student-family-panel__card-name"
            >
              {guardian.fullName}
            </Link>
            <span className="pds-type-body-s-regular student-family-panel__card-meta">
              {guardian.id === primaryGuardianId
                ? t("guardianPrimaryMeta", {
                    relationship: relationshipLabel(guardian.relationship)
                  })
                : t("guardianSecondaryMeta", {
                    relationship: relationshipLabel(guardian.relationship)
                  })}
            </span>
          </div>
          <div className="student-family-panel__card-trailing">
            <span className="pds-type-body-s-bold student-family-panel__card-phone">
              {guardian.phone ?? t("noGuardianPhone")}
            </span>
            {guardian.phone ? (
              <a
                href={`tel:${guardian.phone.replace(/\s/g, "")}`}
                className="student-family-panel__contact-btn"
                aria-label={t("callGuardianAria")}
              >
                <Icon name="call" size={18} />
              </a>
            ) : null}
          </div>
        </li>
      ))
    ) : null;

  const siblingMemberCards =
    siblings.length > 0
      ? siblings.map((member) => (
          <li key={member.id} className="student-family-panel__card">
            <EntityAvatar
              initials={personInitials(member.fullName)}
              nameForColor={member.fullName}
              className="student-family-panel__avatar"
            />
            <div className="student-family-panel__card-main">
              <Link
                href={`/dashboard/students/${member.id}`}
                className="pds-type-body-m-bold student-family-panel__card-name"
              >
                {member.fullName}
              </Link>
              <span className="pds-type-body-s-regular student-family-panel__card-meta">
                {t("siblingMeta", { roll: member.admissionNumber })}
              </span>
            </div>
            {ENROLLED_STATUSES.has(member.status) ? (
              <Badge tone="info" className="student-family-panel__enrolled-badge">
                {t("siblingEnrolled")}
              </Badge>
            ) : (
              <StatusBadge
                status={member.status}
                label={t(`status_${member.status}` as "status_draft")}
              />
            )}
          </li>
        ))
      : null;

  const showFamilyLoading = Boolean(familyGroupId) && family.isLoading;
  const showFamilyError = Boolean(familyGroupId) && family.isError;
  const hasMemberCards = guardians.length > 0 || (familyGroupId && siblings.length > 0);

  const tabFamilyBody = (
    <>
      {showFamilyLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : showFamilyError ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : null}

      {!showFamilyLoading && guardians.length === 0 ? (
        <EmptyState compact embedded icon="supervisor_account" title={t("noGuardians")} />
      ) : null}

      {!showFamilyLoading && hasMemberCards ? (
        <ul className="student-family-panel__cards">
          {guardianMemberCards}
          {familyGroupId ? siblingMemberCards : null}
        </ul>
      ) : null}

      {!familyGroupId ? (
        <p className="pds-type-body-s-regular student-family-panel__notice">
          {hasGuardian ? t("familyNotLinked") : t("familyNeedsGuardian")}
        </p>
      ) : null}

      {familyGroupId && !showFamilyLoading && !showFamilyError ? (
        <Link
          className="pds-type-body-m-bold student-family-panel__tree-link"
          href={`/dashboard/people/households/${familyGroupId}`}
        >
          <Icon name="account_tree" size={18} />
          {t("viewCompleteFamilyTree")}
        </Link>
      ) : null}

      {formError && !joinOpen ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {formError}
        </p>
      ) : null}
    </>
  );

  const sectionFamilyBody = (
    <div className="student-profile-panel-content">
      <p className="pds-type-body-s-regular muted panel-help">{t("familyHelp")}</p>
      {!familyGroupId ? (
        <p className="pds-type-body-s-regular muted">
          {hasGuardian ? t("familyNotLinked") : t("familyNeedsGuardian")}
        </p>
      ) : family.data ? (
        <>
          <article className="student-profile-family-card">
            <div className="student-profile-family__name">
              <strong className="pds-type-title-xs-bold">{family.data.name}</strong>
              {family.data.primaryGuardian ? (
                <span className="pds-type-body-s-regular muted">
                  {t("familyPrimaryGuardian", {
                    name: family.data.primaryGuardian.fullName
                  })}
                </span>
              ) : null}
            </div>
            <Link
              className="pds-type-body-m-bold btn-ghost student-profile-family-card__link"
              href={`/dashboard/people/households/${familyGroupId}`}
            >
              <Icon name="account_tree" />
              {t("viewFamilyTree")}
            </Link>
          </article>
          {siblings.length > 0 ? (
            <>
              <h4 className="pds-type-title-xxs-extrabold student-profile-subheading">
                {t("familyMembersTitle")}
              </h4>
              <ul className="student-profile-family-list">
                {siblings.map((member) => (
                  <li key={member.id}>
                    <Link href={`/dashboard/students/${member.id}`}>{member.fullName}</Link>
                    <span className="pds-type-body-s-regular muted">
                      {member.admissionNumber} · {member.status}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pds-type-body-s-regular muted">{t("familySiblingHint")}</p>
            </>
          ) : (
            <EmptyState compact embedded icon="family_restroom" title={t("familyNoOtherMembers")} />
          )}
        </>
      ) : null}
      {formError && !joinOpen ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );

  const panelShell =
    variant === "tab" ? (
      <div className="panel student-profile-tab-panel student-family-panel">
        <div className="student-family-panel__head">
          <div className="student-family-panel__head-main">
            <h2 className="pds-type-title-s-extrabold student-family-panel__title">{sectionTitle}</h2>
            <p className="pds-type-body-s-regular student-family-panel__help">{t("familyHelp")}</p>
          </div>
          <div className="student-family-panel__head-trailing">{manageActions}</div>
        </div>
        <div className="student-family-panel__body">{tabFamilyBody}</div>
      </div>
    ) : (
      <div className="student-profile-section">
        <div className="dash-page-title">
          <h2 className="pds-type-title-xs-bold dash-page-title__heading">{sectionTitle}</h2>
          <div className="dash-page-title__actions">{manageActions}</div>
        </div>
        <DataTableSection>
          <TablePanelBody
            variant="plain"
            loading={Boolean(familyGroupId) && family.isLoading}
            error={family.isError ? c("somethingWrong") : null}
          >
            {sectionFamilyBody}
          </TablePanelBody>
        </DataTableSection>
      </div>
    );

  return (
    <>
      {panelShell}

      <RecordFormSheet
        open={joinOpen}
        onOpenChange={(open) => {
          setJoinOpen(open);
          if (!open) {
            setSearch("");
            setSelectedFamilyId("");
            setFormError(null);
          }
        }}
        title={familyGroupId ? t("changeFamilyTitle") : t("joinFamilyTitle")}
        help={t("joinFamilyHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          void handleJoinFamily();
        }}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setJoinOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={busy || !selectedFamilyId}>
              <Icon name="check" />
              {setFamilyGroup.isPending ? c("loading") : t("joinFamilyConfirm")}
            </button>
          </>
        }
      >
        <Field label={t("searchFamily")}>
          <TableSearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchFamilyPlaceholder")}
            aria-label={t("searchFamily")}
          />
        </Field>
        {debouncedSearch.length < 2 ? (
          <p className="pds-type-body-s-regular muted">{t("searchFamilyMin")}</p>
        ) : searchResults.isLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : !searchResults.data?.data?.length ? (
          <EmptyState compact embedded icon="search" title={t("searchFamilyEmpty")} />
        ) : (
          <ul className="student-profile-family-search">
            {searchResults.data.data.map((result) => (
              <li key={result.id}>
                <RadioBox
                  name="familyGroup"
                  value={result.id}
                  checked={selectedFamilyId === result.id}
                  onCheckedChange={() => setSelectedFamilyId(result.id)}
                  showDescription={false}
                  label={
                    <span>
                      <strong>{result.name}</strong>
                      <span className="pds-type-body-s-regular muted">
                        {t("familySearchMeta", {
                          count: result.memberCount,
                          guardian: result.primaryGuardianName ?? "—"
                        })}
                      </span>
                      {result.members.length > 0 ? (
                        <span className="pds-type-body-s-regular muted">
                          {result.members.map((member) => member.fullName).join(", ")}
                        </span>
                      ) : null}
                    </span>
                  }
                  className="student-profile-family-option"
                />
              </li>
            ))}
          </ul>
        )}
        {formError ? (
          <p className="pds-type-body-m-medium error-text" role="alert">
            {formError}
          </p>
        ) : null}
      </RecordFormSheet>
    </>
  );
}
