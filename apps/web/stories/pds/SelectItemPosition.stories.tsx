import { Meta, StoryObj } from "@storybook/react";
import { SelectItemPositionProps } from "../../components/pds/composites/select-item-position";
import { SelectItemPosition } from "../../components/pds/composites/select-item-position";
import { DEMO_OPTIONS } from "../../components/pds/test-utils";
import { Options } from "../../components/pds/composites/options";

const meta: Meta<typeof SelectItemPosition> = {
  title: "PDS/Composites/SelectItemPosition",
  component: SelectItemPosition,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: 280, minHeight: 360, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    open: true,
    position: "bottom",
    optionsProps: {
      items: Array.from({ length: 7 }, (_, index) => ({
        id: String(index + 1),
        label: "Label",
      })),
      hasFooter: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof SelectItemPosition>;

export const Bottom: Story = {};
export const Top: Story = { args: { position: "top" } };
export const CustomChild: Story = {
  render: (args: SelectItemPositionProps) => (
    <SelectItemPosition {...args}>
      <Options items={DEMO_OPTIONS} />
    </SelectItemPosition>
  ),
};
