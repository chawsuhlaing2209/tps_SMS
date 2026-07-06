"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { useApiQuery } from "../../../../../lib/api";
import { useCurrentAcademicYear } from "../../../../../lib/use-current-academic-year";
import { TablePanelHead } from "../../../../../lib/table-panel";
import { moduleBreadcrumbs } from "../../../../../lib/page-header-utils";
import { PageHeader } from "../../../../page-header-context";
import { NavigationBackLink } from "../../../../../../components/shared/navigation-back-link";
import {
  InvoicesActionsProvider,
  InvoicesHeaderActionsPortal,
} from "../../_components/invoices-actions-provider";
import { InvoicesTable } from "../../_components/invoices-workspace";

type GradeOverview = {
  id: string;
  name: string;
};

const gradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;

export default function GradeInvoicesPage({
  params
}: {
  params: Promise<{ gradeId: string }>;
}) {
  const { gradeId } = use(params);
  const t = useTranslations("finance");
  const tOverview = useTranslations("finance.overview");
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
          breadcrumbs={moduleBreadcrumbs("invoices", nav, [{ label: pageTitle }])}
          actionsPortal
        />
        <NavigationBackLink
          fallback={{ label: tOverview("title"), href: "/dashboard/finance/overview" }}
        />
        <InvoicesHeaderActionsPortal />
        <section className="panel">
          <TablePanelHead help={t("invoicesGradeHelp")} />
          {yearId ? <InvoicesTable gradeId={gradeId} academicYearId={yearId} /> : null}
        </section>
      </div>
    </InvoicesActionsProvider>
  );
}
