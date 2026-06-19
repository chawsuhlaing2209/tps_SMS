import type { Meta, StoryObj } from "@storybook/react";
import { StatusPill } from "../../components/pds/subcomponents/status-pill";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof StatusPill> = {
  title: "PDS/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof StatusPill>;

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <StatusPill tone="paid">Paid</StatusPill>
      <StatusPill tone="partial">Partial</StatusPill>
      <StatusPill tone="overdue">Overdue</StatusPill>
      <StatusPill tone="due">Due</StatusPill>
      <StatusPill tone="scholarship">Scholarship</StatusPill>
      <StatusPill tone="neutral">Neutral</StatusPill>
    </div>
  ),
};
