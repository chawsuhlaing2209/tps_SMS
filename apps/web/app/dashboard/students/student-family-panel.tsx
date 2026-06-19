"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { RadioBox } from "../../../components/pds";
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

export function StudentFamilyPanel({
  studentId,
  familyGroupId,
  hasGuardian,
  canManage,
  onUpdated
}: {
  studentId: string;
  familyGroupId: string | null | undefined;
  hasGuardian: boolean;
  canManage: boolean;
  onUpdated: () => void;
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

  return (
    <>
      <TablePanelHead
        title={t("familyTitle")}
        help={t("familyHelp")}
        onRefresh={() => void family.refetch()}
        extra={
            canManage ? (
              <div className="form-actions form-actions--inline">
                {!familyGroupId ? (
                  <>
                    <button
                      type="button"
                      className="pds-type-body-m-bold btn-ghost"
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
                ) : (
                  <>
                    <button
                      type="button"
                      className="pds-type-body-m-bold btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setFormError(null);
                        setJoinOpen(true);
                      }}
                    >
                      <Icon name="swap_horiz" />
                      {t("changeFamily")}
                    </button>
                    <button
                      type="button"
                      className="pds-type-body-m-bold btn-ghost"
                      disabled={busy}
                      onClick={() => void handleRemoveFromFamily()}
                    >
                      <Icon name="link_off" />
                      {t("removeFromFamily")}
                    </button>
                  </>
                )}
              </div>
            ) : null
          }
        />

        <TablePanelBody
          loading={Boolean(familyGroupId) && family.isLoading}
          error={family.isError ? c("somethingWrong") : null}
        >
          {!familyGroupId ? (
            <p className="pds-type-body-s-regular muted">{hasGuardian ? t("familyNotLinked") : t("familyNeedsGuardian")}</p>
          ) : family.data ? (
            <>
              <p className="student-profile-family__name">
                <strong>{family.data.name}</strong>
                {family.data.primaryGuardian ? (
                  <span className="pds-type-body-s-regular muted">
                    {t("familyPrimaryGuardian", {
                      name: family.data.primaryGuardian.fullName
                    })}
                  </span>
                ) : null}
              </p>
              <p>
                <Link className="pds-type-body-s-regular row-action" href={`/dashboard/people/households/${familyGroupId}`}>
                  {t("viewFamilyTree")}
                </Link>
              </p>
              {siblings.length > 0 ? (
                <>
                  <h4>{t("familyMembersTitle")}</h4>
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
                  <p className="pds-type-body-s-regular muted panel-help">{t("familySiblingHint")}</p>
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
        </TablePanelBody>

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
                          guardian: result.primaryGuardianName ?? "—",
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