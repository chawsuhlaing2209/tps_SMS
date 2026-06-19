import { Meta, StoryObj } from "@storybook/react";
import { RadioBox } from "../../components/pds/subcomponents/radio-box";

const meta: Meta<typeof RadioBox> = {
  title: "PDS/Subcomponents/RadioBox",
  component: RadioBox,
  tags: ["autodocs"],
  args: {
    label: "Label",
    description: "Description",
    showLabel: true,
    showDescription: false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof RadioBox>;

export const Unselected: Story = {};
export const Selected: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const WithDescription: Story = { args: { showDescription: true } };
export const IndicatorOnly: Story = {
  args: { size: "sm", showLabel: false, showDescription: false, defaultChecked: true },
};
