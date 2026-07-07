import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../ui/button";

describe("Button", () => {
  it("renders filled primary", () => {
    render(<Button buttonType="filled" buttonColor="primary">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("pds-btn--filled");
    expect(button.className).toContain("pds-btn--primary");
  });

  it("renders ghost variant from figma", () => {
    render(
      <Button buttonType="ghost" buttonColor="primary">
        Ghost
      </Button>
    );
    expect(screen.getByRole("button", { name: "Ghost" }).className).toContain("pds-btn--ghost");
  });

  it("renders outlined primary without legacy filled class", () => {
    render(
      <Button buttonType="outlined" buttonColor="primary">
        Outline
      </Button>
    );
    const button = screen.getByRole("button", { name: "Outline" });
    expect(button.className).toContain("pds-btn--outlined");
    expect(button.className).not.toContain("btn-primary");
  });

  it("renders prefix icon", () => {
    render(
      <Button prefixIcon="edit" buttonType="filled">
        Edit
      </Button>
    );
    expect(screen.getByText("edit")).toBeInTheDocument();
  });
});
