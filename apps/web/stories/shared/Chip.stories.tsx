import { Meta, StoryObj } from "@storybook/react";
import { Chip, ChipGroup } from "../../components/shared/chip";

const meta: Meta<typeof Chip> = {
  title: "Shared/Chip",
  component: Chip,
  tags: ["autodocs"],
  args: { children: "G1" },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {};
export const WithDot: Story = { args: { dotColor: "#0d9488", children: "Mathematics" } };

export const Group: Story = {
  render: () => (
    <ChipGroup>
      <Chip>G1</Chip>
      <Chip>G2</Chip>
      <Chip>G3</Chip>
    </ChipGroup>
  ),
};
