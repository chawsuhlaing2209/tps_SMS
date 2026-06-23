"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EntityAvatar } from "../../../components/pds/subcomponents/entity-avatar";
import { DirectoryNameCell } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { TablePanelBody } from "../../lib/table-panel";
import {
  LEADERBOARD_DEMO_ENTRIES,
  LEADERBOARD_DEMO_MONTHS,
  type LeaderboardDemoMonth,
  type LeaderboardEntry
} from "./structure-leaderboard-demo";

type StructureLeaderboardPanelProps = {
  studentCount: number;
};

function rankBadgeClass(rank: number) {
  if (rank === 1) return "structure-leaderboard-rank structure-leaderboard-rank--gold";
  if (rank === 2) return "structure-leaderboard-rank structure-leaderboard-rank--silver";
  if (rank === 3) return "structure-leaderboard-rank structure-leaderboard-rank--bronze";
  return "structure-leaderboard-rank";
}

function trendIcon(trend: LeaderboardEntry["trend"]) {
  if (trend === "up") return "trending_up";
  if (trend === "down") return "trending_down";
  return "trending_flat";
}

function trendClass(trend: LeaderboardEntry["trend"]) {
  if (trend === "up") return "structure-leaderboard-trend structure-leaderboard-trend--up";
  if (trend === "down") return "structure-leaderboard-trend structure-leaderboard-trend--down";
  return "structure-leaderboard-trend structure-leaderboard-trend--flat";
}

function formatTrendDelta(trend: LeaderboardEntry["trend"], delta: number) {
  if (trend === "flat" || delta === 0) return "—";
  const sign = trend === "up" ? "+" : "-";
  return `${sign}${delta}`;
}

type PodiumSlotProps = {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
};

function PodiumSlot({ entry, place }: PodiumSlotProps) {
  const t = useTranslations("academics.leaderboard");
  const medalIcon = place === 1 ? "trophy" : "workspace_premium";

  return (
    <article className={`structure-leaderboard-podium__slot structure-leaderboard-podium__slot--${place}`}>
      <div className="structure-leaderboard-podium__avatar-wrap">
        <div
          className={`structure-leaderboard-podium__avatar structure-leaderboard-podium__avatar--${place}`}
          style={{ background: entry.avatarColor }}
        >
          <span className="pds-type-title-s-extrabold structure-leaderboard-podium__initials">{entry.initials}</span>
        </div>
        <Icon
          name={medalIcon}
          className={`structure-leaderboard-podium__medal structure-leaderboard-podium__medal--${place}`}
          size={20}
        />
      </div>
      <p className="pds-type-body-s-bold structure-leaderboard-podium__name">{entry.name}</p>
      <p className="pds-type-caption-m structure-leaderboard-podium__meta">
        {t("podiumMeta", { room: entry.room, aggregate: entry.aggregate })}
      </p>
      <div className={`structure-leaderboard-podium__pedestal structure-leaderboard-podium__pedestal--${place}`}>
        <span className="pds-type-title-m-extrabold structure-leaderboard-podium__place">{place}</span>
      </div>
    </article>
  );
}

export function StructureLeaderboardPanel({ studentCount }: StructureLeaderboardPanelProps) {
  const t = useTranslations("academics.leaderboard");
  const [activeMonth, setActiveMonth] = useState<LeaderboardDemoMonth>("july");

  const topThree = useMemo(() => {
    const sorted = [...LEADERBOARD_DEMO_ENTRIES].sort((a, b) => a.rank - b.rank);
    return {
      first: sorted.find((row) => row.rank === 1)!,
      second: sorted.find((row) => row.rank === 2)!,
      third: sorted.find((row) => row.rank === 3)!
    };
  }, []);

  return (
    <div className="structure-leaderboard">
      <div className="structure-leaderboard-filters">
        <span className="pds-type-body-s-bold structure-leaderboard-filters__label">{t("monthlyExam")}</span>
        <div className="structure-leaderboard-filters__months" role="tablist" aria-label={t("monthlyExam")}>
          {LEADERBOARD_DEMO_MONTHS.map((month) => {
            const active = month === activeMonth;
            return (
              <button
                key={month}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "structure-leaderboard-month structure-leaderboard-month--active" : "structure-leaderboard-month"}
                onClick={() => setActiveMonth(month)}
              >
                {t(`months.${month}`)}
              </button>
            );
          })}
        </div>
        <p className="pds-type-caption-m structure-leaderboard-filters__hint">
          <Icon name="info" size={16} />
          {t("rankedByHint")}
        </p>
      </div>

      <section className="structure-leaderboard-podium" aria-label={t("topPerformersTitle")}>
        <header className="structure-leaderboard-podium__head">
          <Icon name="trophy" size={18} />
          <span className="pds-type-caption-m-bold structure-leaderboard-podium__eyebrow">{t("topPerformersTitle")}</span>
          <span className="pds-type-caption-m-bold structure-leaderboard-podium__month">{t(`months.${activeMonth}`)}</span>
        </header>
        <div className="structure-leaderboard-podium__stage">
          <PodiumSlot entry={topThree.second} place={2} />
          <PodiumSlot entry={topThree.first} place={1} />
          <PodiumSlot entry={topThree.third} place={3} />
        </div>
      </section>

      <TablePanelBody>
        <div className="padauk-table-wrap">
          <table className="pds-type-body-m-medium padauk-table structure-leaderboard-padauk-table">
            <thead>
              <tr>
                <th className="pds-type-caption-s">{t("columns.rank")}</th>
                <th className="pds-type-caption-s">{t("columns.student")}</th>
                <th className="pds-type-caption-s">{t("columns.room")}</th>
                <th className="pds-type-caption-s structure-leaderboard-padauk-table__center">
                  {t("columns.aggregate")}
                </th>
                <th className="pds-type-caption-s structure-leaderboard-padauk-table__center">
                  {t("columns.trend")}
                </th>
              </tr>
            </thead>
            <tbody>
              {LEADERBOARD_DEMO_ENTRIES.map((entry) => (
                <tr key={entry.rank}>
                  <td>
                    <span className={rankBadgeClass(entry.rank)}>{entry.rank}</span>
                  </td>
                  <td>
                    <DirectoryNameCell
                      name={entry.name}
                      avatar={
                        <EntityAvatar
                          initials={entry.initials}
                          color={entry.avatarColor}
                          nameForColor={entry.name}
                        />
                      }
                    />
                  </td>
                  <td className="padauk-table__muted">{entry.room}</td>
                  <td className="structure-leaderboard-padauk-table__center">
                    <span className="pds-type-body-m-extrabold">
                      {t("aggregateValue", { value: entry.aggregate })}
                    </span>
                  </td>
                  <td className="structure-leaderboard-padauk-table__center">
                    <span className={trendClass(entry.trend)}>
                      {entry.trend !== "flat" ? <Icon name={trendIcon(entry.trend)} size={16} /> : null}
                      <span className="pds-type-caption-m-bold">{formatTrendDelta(entry.trend, entry.trendDelta)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pds-type-caption-m muted structure-leaderboard-table__footnote">
          {t("demoFootnote", { count: studentCount })}
        </p>
      </TablePanelBody>
    </div>
  );
}
