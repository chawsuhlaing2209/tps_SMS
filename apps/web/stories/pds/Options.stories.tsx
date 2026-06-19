import { Meta, StoryObj } from "@storybook/react";
import { Options } from "../../components/pds/composites/options";

const labels = Array.from({ length: 11 }, (_, index) => ({
  id: String(index + 1),
  label: "Label",
}));

const meta: Meta<typeof Options> = {
  title: "PDS/Composites/Options",
  component: Options,
  tags: ["autodocs"],
  args: {
    items: labels.slice(0, 3),
    variant: "default",
    hasFooter: false,
  },
};

export default meta;
type Story = StoryObj<typeof Options>;

export const ThreeItems: Story = {};
export const FiveItems: Story = { args: { items: labels.slice(0, 5) } };
export const SevenItemsWithFooter: Story = {
  args: { items: labels.slice(0, 7), hasFooter: true },
};
export const ElevenItemsScrollable: Story = {
  args: { items: labels, hasFooter: true },
};
