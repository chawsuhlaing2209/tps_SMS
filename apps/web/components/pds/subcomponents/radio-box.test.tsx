import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioBox } from "./radio-box";

describe("RadioBox", () => {
  it("renders selected indicator", () => {
    render(<RadioBox checked showLabel={false} showDescription={false} size="sm" />);
    expect(document.querySelector(".pds-radio-box__indicator--checked")).toBeTruthy();
  });

  it("toggles when uncontrolled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<RadioBox onCheckedChange={onCheckedChange} label="Option A" />);
    const radio = screen.getByRole("radio", { name: "Option A" });
    expect(radio).toHaveAttribute("aria-checked", "false");
    await user.click(radio);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(radio).toHaveAttribute("aria-checked", "true");
    await user.click(radio);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(radio).toHaveAttribute("aria-checked", "false");
  });

  it("renders material radio icon when unchecked", () => {
    render(<RadioBox label="Option A" />);
    expect(document.querySelector(".pds-radio-box__indicator .ms")).toHaveTextContent(
      "radio_button_unchecked"
    );
  });

  it("exposes aria-checked", () => {
    render(<RadioBox checked label="Selected" />);
    expect(screen.getByRole("radio", { name: "Selected" })).toHaveAttribute("aria-checked", "true");
  });
});
