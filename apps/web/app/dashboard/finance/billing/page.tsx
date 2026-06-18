"use client";

import { useTranslations } from "next-intl";
import { useApiQuery } from "../../../lib/api";
import { EnrollmentsWorkspace } from "../../enrollments/enrollments-workspace";

type FinanceDashboard = {
  totalRevenue: number;
  totalOutstandingAR: number;
  collectionRate: number;
  overdueCount: number;
};

export default function FinanceBillingPage() {
  const t = useTranslations("finance");
  const c = useTranslations("common");

  const dashboard = useApiQuery<FinanceDashboard>(
    (tenant) => `/tenants/${tenant}/finance/reports/dashboard`
  );

  return (
    <div className="billing-page">
      <section>
        {dashboard.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : (
          <div className="structure-year-stats">
            <div className="structure-stat">
              <strong>{dashboard.data?.totalRevenue ?? 0}</strong>
              <span>{t("totalRevenue")}</span>
            </div>
            <div className="structure-stat">
              <strong>{dashboard.data?.totalOutstandingAR ?? 0}</strong>
              <span>{t("totalOutstanding")}</span>
            </div>
            <div className="structure-stat">
              <strong>{dashboard.data?.collectionRate ?? 0}%</strong>
              <span>{t("collectionRate")}</span>
            </div>
            <div className="structure-stat">
              <strong>{dashboard.data?.overdueCount ?? 0}</strong>
              <span>{t("overdueCount")}</span>
            </div>
          </div>
        )}
      </section>

      <EnrollmentsWorkspace compactTitle showStatusFilter />
    </div>
  );
}
