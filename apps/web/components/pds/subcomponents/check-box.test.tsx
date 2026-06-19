import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckBox } from "./check-box";

describe("CheckBox", () => {
  it("renders unchecked state with label", () => {
    render(<CheckBox checked={false} label="Accept terms" />);
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByText("Accept terms")).toBeInTheDocument();
  });

  it("toggles on click when uncontrolled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<CheckBox onCheckedChange={onCheckedChange} label="Terms" />);
    const checkbox = screen.getByRole("checkbox", { name: "Terms" });
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(checkbox).toHaveAttribute("data-state", "checked");
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  it("applies checked visual class", () => {
    render(<CheckBox checked showLabel={false} showDescription={false} size="sm" />);
    expect(document.querySelector(".pds-check-box__indicator--checked")).toBeTruthy();
  });

  it("renders material checkbox icon when unchecked", () => {
    render(<CheckBox label="Pick me" />);
    expect(document.querySelector(".pds-check-box__indicator .ms")).toHaveTextContent(
      "check_box_outline_blank"
    );
  });

  it("maps figma node metadata", () => {
    render(<CheckBox label="Track me" />);
    expect(
      screen.getByRole("checkbox", { name: "Track me" }).closest("[data-figma-node='35:14933']")
    ).toBeTruthy();
  });
});
