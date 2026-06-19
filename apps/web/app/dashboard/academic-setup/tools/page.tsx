"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch, useApiMutation } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { getSession } from "../../../lib/session";
import { ModulePageHeader } from "../../module-page-header";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";

type MasterData = {
  grades: { name: string; minAge?: number | null; maxAge?: number | null }[];
  subjects: { name: string; code: string | null; subjectType: string }[];
};
type ImportResult = { grades: number; subjects: number };

const IMPORT_JSON_PLACEHOLDER = '{ "grades": [], "subjects": [] }';

export default function MasterDataToolsPage() {
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");

  const [exported, setExported] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [importText, setImportText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const importMutation = useApiMutation<MasterData, ImportResult>((body, tenant) => ({
    path: `/tenants/${tenant}/academics/master-data/import`,
    init: { method: "POST", body: JSON.stringify(body) }
  }));

  async function handleExport() {
    const session = getSession();
    if (!session) {
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const data = await apiFetch<MasterData>(
        `/tenants/${session.tenantId}/academics/master-data/export`
      );
      const json = JSON.stringify(data, null, 2);
      setExported(json);

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `master-data-${session.tenantSlug}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : c("somethingWrong"));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    setImportError(null);
    setImportResult(null);
    let parsed: MasterData;
    try {
      parsed = JSON.parse(importText) as MasterData;
    } catch {
      setImportError(t("invalidJson"));
      return;
    }
    try {
      const result = await importMutation.mutateAsync(parsed);
      setImportResult(result);
      setImportText("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : c("somethingWrong"));
    }
  }

  return (
    <div className="page-stack">
      <ModulePageHeader
        navKey="academicSetup"
        title={setup("tools")}
        breadcrumbs={moduleBreadcrumbs("academicSetup", nav, [{ label: setup("tools") }])}
      />
      <section className="panel">
        <div className="panel-head">
          <h2 className="pds-type-title-xs-bold">{t("exportTitle")}</h2>
          <button type="button" className="pds-type-body-m-bold btn-primary" disabled={exporting} onClick={() => void handleExport()}>
            <Icon name="download" />
            {exporting ? c("loading") : t("exportButton")}
          </button>
        </div>
        <p className="pds-type-body-s-regular muted">{t("exportHelp")}</p>
        {exportError ? <p className="pds-type-body-m-medium error-text">{exportError}</p> : null}
        {exported ? <textarea className="pds-type-body-m-medium code-area" readOnly value={exported} /> : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="pds-type-title-xs-bold">{t("importTitle")}</h2>
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={importMutation.isPending || !importText.trim()}
            onClick={() => void handleImport()}
          >
            <Icon name="upload" />
            {importMutation.isPending ? c("loading") : t("importButton")}
          </button>
        </div>
        <p className="pds-type-body-s-regular muted">{t("importHelp")}</p>
        <textarea
          className="pds-type-body-m-medium code-area"
          placeholder={IMPORT_JSON_PLACEHOLDER}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        {importError ? <p className="pds-type-body-m-medium error-text">{importError}</p> : null}
        {importResult ? (
          <p className="pds-type-body-m-medium form-feedback form-feedback--ok">
            {t("importSummary", {
              grades: importResult.grades,
              subjects: importResult.subjects
            })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
