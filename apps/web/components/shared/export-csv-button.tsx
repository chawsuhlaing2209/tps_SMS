"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  buildCsvContent,
  buildSectionedCsv,
  downloadCsv,
  type CsvColumn,
  type CsvRow
} from "../../app/lib/export-csv";
import { Button } from "../ui/button";

export type ExportCsvPayload = {
  filename: string;
  columns: CsvColumn[];
  rows: CsvRow[];
};

export type ExportCsvSectionedPayload = {
  filename: string;
  sections: Array<{ title: string; columns: CsvColumn[]; rows: CsvRow[] }>;
};

export type ExportCsvResult = ExportCsvPayload | ExportCsvSectionedPayload;

function isSectioned(payload: ExportCsvResult): payload is ExportCsvSectionedPayload {
  return "sections" in payload;
}

export function ExportCsvButton({
  disabled,
  onExport
}: {
  disabled?: boolean;
  onExport: () => Promise<ExportCsvResult>;
}) {
  const t = useTranslations("common");
  const [exporting, setExporting] = useState(false);

  return (
    <Button
      type="button"
      buttonType="outlined"
      buttonColor="secondary"
      prefixIcon="download"
      disabled={disabled || exporting}
      onClick={() => {
        void (async () => {
          setExporting(true);
          try {
            const payload = await onExport();
            const content = isSectioned(payload)
              ? buildSectionedCsv(payload.sections)
              : buildCsvContent(payload.columns, payload.rows);
            downloadCsv(payload.filename, content);
          } finally {
            setExporting(false);
          }
        })();
      }}
    >
      {exporting ? t("exporting") : t("exportCsv")}
    </Button>
  );
}
