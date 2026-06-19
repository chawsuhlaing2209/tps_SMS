import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { OptionChip, OptionChipGrid } from "../../components/shared/option-chip";

const meta: Meta<typeof OptionChip> = {
  title: "Shared/OptionChip",
  component: OptionChip,
  tags: ["autodocs"],
  args: {
    label: "Tuition fee",
    detail: "450,000 MMK",
  },
};

export default meta;
type Story = StoryObj<typeof OptionChip>;

export const Unselected: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true, selected: true } };

export const Grid: Story = {
  render: function OptionChipDemo() {
    const [selected, setSelected] = useState("tuition");
    return (
      <OptionChipGrid>
        <OptionChip
          label="Tuition fee"
          detail="450,000 MMK"
          selected={selected === "tuition"}
          onClick={() => setSelected("tuition")}
        />
        <OptionChip
          label="Transport"
          detail="80,000 MMK"
          selected={selected === "transport"}
          onClick={() => setSelected("transport")}
        />
        <OptionChip
          label="Uniform"
          detail="35,000 MMK"
          selected={selected === "uniform"}
          onClick={() => setSelected("uniform")}
        />
      </OptionChipGrid>
    );
  },
  parameters: { layout: "padded" },
};
