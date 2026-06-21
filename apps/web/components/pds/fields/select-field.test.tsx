import { describe, expect, it } from "vitest";
import { withFilterAllOption } from "./select-field";

describe("withFilterAllOption", () => {
  it("prepends an all row for filter selects", () => {
    expect(
      withFilterAllOption(
        "All grades",
        [
          { value: "kg", label: "KG" },
          { value: "g1", label: "Grade 1" },
        ],
        "filter"
      )
    ).toEqual([
      { value: "", label: "All grades" },
      { value: "kg", label: "KG" },
      { value: "g1", label: "Grade 1" },
    ]);
  });

  it("skips duplicate all rows", () => {
    const options = [
      { value: "all", label: "All sources" },
      { value: "enrollment", label: "Enrollment" },
    ];
    expect(withFilterAllOption("All sources", options, "filter")).toEqual(options);
  });

  it("does not modify form selects", () => {
    const options = [{ value: "kg", label: "KG" }];
    expect(withFilterAllOption("All grades", options, "form")).toEqual(options);
  });

  it("skips auto all row when placeholder is the generic default", () => {
    const options = [{ value: "en", label: "English" }];
    expect(withFilterAllOption("Select", options, "filter")).toEqual(options);
  });
});
