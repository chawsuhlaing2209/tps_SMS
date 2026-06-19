import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PdsSelect } from "./select";

const items = [
  { id: "1", label: "Grade 1" },
  { id: "2", label: "Grade 2" },
  { id: "3", label: "Grade 3" },
];

describe("PdsSelect", () => {
  it("opens options on trigger click", async () => {
    const user = userEvent.setup();
    render(<PdsSelect items={items} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("selects single value when uncontrolled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <PdsSelect variant="filter" items={items} onValueChange={onValueChange} placeholder="Select" />
    );
    await user.click(screen.getByRole("combobox"));
    const option = screen.getAllByRole("option")[1];
    if (!option) throw new Error("expected second option");
    await user.click(option);
    expect(onValueChange).toHaveBeenCalledWith("2");
    expect(screen.getByText("Grade 2")).toBeInTheDocument();
    expect(document.querySelector(".pds-select__trigger--selected")).toBeTruthy();
  });

  it("stretches options panel to trigger width", async () => {
    const user = userEvent.setup();
    render(<PdsSelect items={items} />);
    await user.click(screen.getByRole("combobox"));
    expect(document.querySelector(".pds-options--fill")).toBeTruthy();
  });

  it("applies error state class", () => {
    render(<PdsSelect items={items} state="error" value="1" />);
    expect(document.querySelector(".pds-select__trigger--error")).toBeTruthy();
  });
});
