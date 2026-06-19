"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useApiQuery } from "../../../../../lib/api";
import { useCurrentAcademicYear } from "../../../../../lib/use-current-academic-year";
import { TablePanelHead } from "../../../../../lib/table-panel";
import { financeBreadcrumbs } from "../../../../../lib/page-header-utils";
import { PageHeader } from "../../../../page-header-context";
import {
  InvoicesActionsProvider,
  InvoicesBillingMonthFilter,
  InvoicesHeaderActionsPortal,
} from "../../_components/invoices-actions-provider";
import { InvoicesTable } from "../../_components/invoices-workspace";

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
  const pageTitle = t("invoicesGradeTitle", { grade: gradeName });

  return (
    <InvoicesActionsProvider gradeId={gradeId} gradeName={gradeName}>
      <div className="page-stack">
        <PageHeader
          title={pageTitle}
          breadcrumbs={financeBreadcrumbs(nav, [
            { label: t("invoices"), href: "/dashboard/finance/invoices" },
            { label: pageTitle },
          ])}
          actionsPortal
        />
        <InvoicesHeaderActionsPortal />
        <section className="panel">
          <TablePanelHead
            title={pageTitle}
            help={t("invoicesGradeHelp")}
            onRefresh={() => void grades.refetch()}
            extra={<InvoicesBillingMonthFilter />}
          />
          {yearId ? <InvoicesTable gradeId={gradeId} academicYearId={yearId} /> : null}
        </section>
      </div>
    </InvoicesActionsProvider>
  );
}
