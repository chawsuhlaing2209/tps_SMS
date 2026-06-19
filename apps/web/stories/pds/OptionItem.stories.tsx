import { Meta, StoryObj } from "@storybook/react";
import { OptionItem } from "../../components/pds/composites/option-item";

const meta: Meta<typeof OptionItem> = {
  title: "PDS/Composites/OptionItem",
  component: OptionItem,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Label",
    variant: "default",
    isSelected: false,
    hasDivider: true,
  },
};

export default meta;
type Story = StoryObj<typeof OptionItem>;

export const DefaultIdle: Story = {};
export const DefaultSelected: Story = { args: { isSelected: true } };
export const DefaultHovered: Story = { args: { state: "hovered" } };
export const RadioIdle: Story = { args: { variant: "radio" } };
export const RadioSelected: Story = { args: { variant: "radio", isSelected: true } };
export const CheckboxIdle: Story = { args: { variant: "checkbox" } };
export const CheckboxSelected: Story = { args: { variant: "checkbox", isSelected: true } };
