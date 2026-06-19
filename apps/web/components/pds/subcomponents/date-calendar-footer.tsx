"use client";

import { Button } from "../../ui/button";

export type DateCalendarFooterProps = {
  todayLabel?: string;
  okayLabel?: string;
  onToday?: () => void;
  onOkay?: () => void;
};

/** Calendar footer — Today link + Okay confirm (Figma 67:14513). */
export function DateCalendarFooter({
  todayLabel = "Today",
  okayLabel = "Okay",
  onToday,
  onOkay,
}: DateCalendarFooterProps) {
  return (
    <div className="pds-date-calendar__footer">
      <button type="button" className="pds-type-body-m-medium pds-date-calendar__today" onClick={onToday}>
        {todayLabel}
      </button>
      <Button buttonType="filled" buttonColor="secondary" type="button" onClick={onOkay}>
        {okayLabel}
      </Button>
    </div>
  );
}
