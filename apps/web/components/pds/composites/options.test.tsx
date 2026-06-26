import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Options } from "./options";

const items = Array.from({ length: 7 }, (_, index) => ({
  id: String(index + 1),
  label: "Label",
}));

describe("Options", () => {
  it("renders item list", () => {
    render(<Options items={items.slice(0, 3)} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("renders footer actions when enabled", async () => {
    const user = userEvent.setup();
    const onOkay = vi.fn();
    render(<Options items={items} hasFooter onOkay={onOkay} />);
    await user.click(screen.getByRole("button", { name: "Okay" }));
    expect(onOkay).toHaveBeenCalled();
  });

  it("renders every option and lets the list scroll when they overflow", () => {
    const { container } = render(<Options items={items} />);
    // All options stay in the DOM — none are dropped to avoid clipping.
    expect(screen.getAllByRole("option")).toHaveLength(7);
    const list = container.querySelector(".pds-options__list");
    expect(list).toBeInTheDocument();
    expect(getComputedStyle(list as Element).overflowY).toBe("auto");
  });
});
