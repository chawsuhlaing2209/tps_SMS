import { Meta, StoryObj } from "@storybook/react";
import { CheckBox } from "../../components/pds/subcomponents/check-box";

const meta: Meta<typeof CheckBox> = {
  title: "PDS/Subcomponents/CheckBox",
  component: CheckBox,
  tags: ["autodocs"],
  args: {
    label: "Label",
    showLabel: true,
    showDescription: false,
    indeterminate: false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof CheckBox>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const IndicatorOnly: Story = {
  args: { size: "sm", showLabel: false, showDescription: false },
};
export const Indeterminate: Story = { args: { indeterminate: true, checked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const WithDescription: Story = {
  args: { showDescription: true, checked: true },
};
