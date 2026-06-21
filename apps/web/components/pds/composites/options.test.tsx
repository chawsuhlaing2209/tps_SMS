import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPTIONS_MAX_PANEL_HEIGHT, Options } from "./options";

const items = Array.from({ length: 7 }, (_, index) => ({
  id: String(index + 1),
  label: "Label",
}));

type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;

beforeEach(() => {
  resizeObserverCallback = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockListScrollHeight(height: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      if (this.classList?.contains("pds-options__list")) {
        return height;
      }
      return 0;
    },
  });
}

function triggerMeasure() {
  resizeObserverCallback?.([], {} as ResizeObserver);
}

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

  it("does not clip short lists below the max panel height", () => {
    mockListScrollHeight(OPTIONS_MAX_PANEL_HEIGHT - 1);
    const { container } = render(<Options items={items.slice(0, 3)} />);
    triggerMeasure();

    const panel = container.querySelector(".pds-options");
    expect(panel).not.toHaveClass("pds-options--scrollable");
    expect(panel).not.toHaveStyle({ maxHeight: `${OPTIONS_MAX_PANEL_HEIGHT}px` });
  });

  it("caps and scrolls when content exceeds the max panel height", () => {
    mockListScrollHeight(OPTIONS_MAX_PANEL_HEIGHT + 1);
    const { container } = render(<Options items={items} />);
    triggerMeasure();

    const panel = container.querySelector(".pds-options");
    expect(panel).toHaveClass("pds-options--scrollable");
    expect(panel).toHaveStyle({ maxHeight: `${OPTIONS_MAX_PANEL_HEIGHT}px` });
    expect(container.querySelector(".pds-options__scrollbar")).toBeInTheDocument();
  });
});
