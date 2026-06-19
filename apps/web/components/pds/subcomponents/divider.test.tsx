import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Divider } from "./divider";

describe("Divider", () => {
  it("renders solid line by default", () => {
    const { container } = render(<Divider />);
    const divider = container.querySelector(".pds-divider");
    expect(divider).toBeTruthy();
    expect(divider?.classList.contains("pds-divider--dashed")).toBe(false);
  });

  it("supports dashed padded xl variant", () => {
    const { container } = render(<Divider dashed hasPadding size="xl" />);
    const divider = container.querySelector(".pds-divider");
    expect(divider?.classList.contains("pds-divider--dashed")).toBe(true);
    expect(divider?.classList.contains("pds-divider--padded")).toBe(true);
    expect(divider?.classList.contains("pds-divider--size-xl")).toBe(true);
  });
});
