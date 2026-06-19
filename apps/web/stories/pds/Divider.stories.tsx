import { Meta, StoryObj } from "@storybook/react";
import { Divider } from "../../components/pds/subcomponents/divider";

const meta: Meta<typeof Divider> = {
  title: "PDS/Subcomponents/Divider",
  component: Divider,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: 192 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    size: "sm",
    dashed: false,
    hasPadding: false,
  },
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Solid: Story = {};
export const Dashed: Story = { args: { dashed: true } };
export const PaddedMedium: Story = { args: { hasPadding: true, size: "md" } };
export const PaddedXLDashed: Story = {
  args: { hasPadding: true, size: "xl", dashed: true },
};
