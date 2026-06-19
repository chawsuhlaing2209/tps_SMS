import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Toggle } from "../../components/shared/toggle";

const meta: Meta<typeof Toggle> = {
  title: "Shared/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { "aria-label": "Enable rule" },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Off: Story = { args: { defaultChecked: false } };
export const On: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const WithLabel: Story = {
  args: { label: "Active", id: "toggle-demo", defaultChecked: true },
};

export const Interactive: Story = {
  render: function InteractiveToggle() {
    const [checked, setChecked] = useState(true);
    return (
      <Toggle
        id="toggle-interactive"
        label="Discount rule enabled"
        checked={checked}
        onCheckedChange={setChecked}
      />
    );
  },
};
