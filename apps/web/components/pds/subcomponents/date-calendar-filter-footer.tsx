"use client";

import { Button } from "../../ui/button";

export type DateCalendarFilterFooterProps = {
  okayLabel?: string;
  onOkay?: () => void;
};

/** Filter range footer — Okay only, right-aligned (Figma 67:14836). */
export function DateCalendarFilterFooter({
  okayLabel = "Okay",
  onOkay,
}: DateCalendarFilterFooterProps) {
  return (
    <div className="pds-date-calendar__filter-footer">
      <Button buttonType="filled" buttonColor="primary" type="button" onClick={onOkay}>
        {okayLabel}
      </Button>
    </div>
  );
}
