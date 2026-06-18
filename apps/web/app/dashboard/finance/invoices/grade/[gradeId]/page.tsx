"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useApiQuery } from "../../../../../lib/api";
import { useCurrentAcademicYear } from "../../../../../lib/use-current-academic-year";
import { TablePanelHead } from "../../../../../lib/table-panel";
import { PageHeader } from "../../../../page-header-context";
import { InvoicesTable, InvoicesToolbar } from "../../_components/invoices-workspace";

type GradeOverview = {
  id: string;
  name: string;
};

const gradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;

export default function GradeInvoicesPage() {
  const params = useParams<{ gradeId: string }>();
  const gradeId = params.gradeId;
  const t = useTranslations("finance");
  const nav = useTranslations("nav");
  const currentYear = useCurrentAcademicYear();
  const yearId = currentYear.data?.id ?? "";

  const grades = useApiQuery<GradeOverview[]>((tenant) =>
    yearId ? gradesPath(tenant, yearId) : null
  );

  const grade = grades.data?.find((row) => row.id === gradeId);
  const gradeName = grade?.name ?? gradeId.slice(0, 8);

  return (
    <div className="page-stack">
      <PageHeader
        title={t("invoicesGradeTitle", { grade: gradeName })}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: t("invoices"), href: "/dashboard/finance/invoices" }
        ]}
        backHref="/dashboard/finance/invoices"
        backLabel={t("invoices")}
      />
      <section className="panel">
        <TablePanelHead
          title={t("invoicesGradeTitle", { grade: gradeName })}
          help={t("invoicesGradeHelp")}
          onRefresh={() => void grades.refetch()}
          extra={<InvoicesToolbar gradeId={gradeId} gradeName={gradeName} />}
        />
        {yearId ? <InvoicesTable gradeId={gradeId} academicYearId={yearId} /> : null}
      </section>
    </div>
  );
}
