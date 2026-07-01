"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "../../../components/shared/empty-state";
import { TrailLink } from "../../../components/shared/trail-link";
import { formatMMK } from "../../lib/money";
import { Icon } from "../../lib/material-icon";
import { RecordPaymentModal } from "../finance/invoices/_components/record-payment-modal";

export type BillingMember = {
  studentId: string;
  fullName: string;
  totalOutstanding: number;
  totalPaid: number;
  /** Collectable now — outstanding minus amounts already awaiting verification. */
  recordable: number;
};

/**
 * Per-student balance roll-up with a Collect action, shared by household and
 * guardian detail pages. Members (with resolved balances) and the academic year
 * are supplied by the parent; this panel owns the collect modal.
 */
export function PeopleBillingPanel({
  title,
  members,
  academicYearId,
  loading,
  error,
  canCollect,
  fromLabel,
  fromHref,
  onRefresh
}: {
  title: string;
  members: BillingMember[];
  academicYearId: string | null;
  loading: boolean;
  error: boolean;
  canCollect: boolean;
  fromLabel: string;
  fromHref: string;
  onRefresh: () => void;
}) {
  const f = useTranslations("finance");
  const c = useTranslations("common");
  const [collectStudentId, setCollectStudentId] = useState<string | null>(null);

  return (
    <section className="panel people-billing">
      <div className="dash-page-title">
        <h2 className="pds-type-title-s-extrabold dash-page-title__heading">{title}</h2>
      </div>

      {loading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : error ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : !members.length ? (
        <EmptyState compact embedded icon="account_balance_wallet" title={f("noInvoices")} />
      ) : (
        <ul className="people-billing__list">
          {members.map((member) => (
            <li key={member.studentId} className="people-billing__row">
              <div className="people-billing__main">
                <TrailLink
                  href={`/dashboard/students/${member.studentId}?tab=billing`}
                  className="pds-type-body-m-bold people-billing__name"
                  from={{ label: fromLabel, href: fromHref }}
                >
                  {member.fullName}
                </TrailLink>
                <span className="pds-type-body-s-regular muted">
                  {f("totalPaid")}: {formatMMK(member.totalPaid)}
                </span>
              </div>
              <div className="people-billing__trailing">
                <div className="people-billing__amount">
                  <span className="pds-type-body-s-regular muted">{f("totalOutstanding")}</span>
                  <strong className="pds-type-title-xxs-extrabold">
                    {formatMMK(member.totalOutstanding)}
                  </strong>
                </div>
                {canCollect && academicYearId && member.recordable > 0 ? (
                  <button
                    type="button"
                    className="pds-type-body-s-semibold btn-primary"
                    onClick={() => setCollectStudentId(member.studentId)}
                  >
                    <Icon name="point_of_sale" size={16} />
                    {f("collectPayment")}
                  </button>
                ) : member.totalOutstanding > 0 ? (
                  <span className="badge badge--pending">{f("pendingVerification")}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {academicYearId ? (
        <RecordPaymentModal
          variant="roster"
          open={Boolean(collectStudentId)}
          onOpenChange={(open) => {
            if (!open) setCollectStudentId(null);
          }}
          initialStudentId={collectStudentId}
          academicYearId={academicYearId}
          onCollected={() => {
            setCollectStudentId(null);
            onRefresh();
          }}
        />
      ) : null}
    </section>
  );
}
