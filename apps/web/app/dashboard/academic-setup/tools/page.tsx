"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch, useApiMutation } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { getSession } from "../../../lib/session";

type MasterData = {
  grades: { name: string; minAge?: number | null; maxAge?: number | null }[];
  subjects: { name: string; code: string | null; subjectType: string }[];
};
type ImportResult = { grades: number; subjects: number };

const IMPORT_JSON_PLACEHOLDER = '{ "grades": [], "subjects": [] }';

export default function MasterDataToolsPage() {
  const t = useTranslations("academics");
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
      <section className="panel">
        <div className="panel-head">
          <h2>{t("exportTitle")}</h2>
          <button type="button" className="btn-primary" disabled={exporting} onClick={() => void handleExport()}>
            <Icon name="download" />
            {exporting ? c("loading") : t("exportButton")}
          </button>
        </div>
        <p className="muted">{t("exportHelp")}</p>
        {exportError ? <p className="error-text">{exportError}</p> : null}
        {exported ? <textarea className="code-area" readOnly value={exported} /> : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("importTitle")}</h2>
          <button
            type="button"
            className="btn-primary"
            disabled={importMutation.isPending || !importText.trim()}
            onClick={() => void handleImport()}
          >
            <Icon name="upload" />
            {importMutation.isPending ? c("loading") : t("importButton")}
          </button>
        </div>
        <p className="muted">{t("importHelp")}</p>
        <textarea
          className="code-area"
          placeholder={IMPORT_JSON_PLACEHOLDER}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        {importError ? <p className="error-text">{importError}</p> : null}
        {importResult ? (
          <p className="form-feedback form-feedback--ok">
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
