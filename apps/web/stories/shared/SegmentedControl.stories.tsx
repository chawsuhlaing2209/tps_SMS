import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SegmentedControl } from "../../components/shared/segmented-control";

const options = [
  { id: "all", label: "All grades" },
  { id: "specific", label: "Specific grades" },
];

const meta: Meta<typeof SegmentedControl> = {
  title: "Shared/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  args: {
    options,
    value: "all",
    ariaLabel: "Grade scope",
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

export const Default: Story = {};

export const Interactive: Story = {
  render: function InteractiveSegmentedControl() {
    const [value, setValue] = useState("all");
    return (
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
        ariaLabel="Grade scope"
      />
    );
  },
};

export const ThreeWay: Story = {
  render: function ThreeWay() {
    const [value, setValue] = useState("term");
    return (
      <SegmentedControl
        options={[
          { id: "term", label: "Term" },
          { id: "year", label: "Year" },
          { id: "custom", label: "Custom" },
        ]}
        value={value}
        onChange={setValue}
        ariaLabel="Billing period"
      />
    );
  },
};
