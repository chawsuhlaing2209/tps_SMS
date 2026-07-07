import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionItem } from "../composites/option-item";

describe("OptionItem", () => {
  it("selects default row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OptionItem label="Grade 1" onSelect={onSelect} />);
    await user.click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("shows radio subcomponent for radio variant", () => {
    render(<OptionItem variant="radio" isSelected label="Grade 1" />);
    expect(document.querySelector(".pds-radio-box__indicator--checked")).toBeTruthy();
  });

  it("shows checkbox subcomponent for checkbox variant", () => {
    render(<OptionItem variant="checkbox" isSelected label="Grade 1" />);
    expect(document.querySelector(".pds-check-box__indicator--checked")).toBeTruthy();
  });
});
