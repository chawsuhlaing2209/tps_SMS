import { Meta, StoryObj } from "@storybook/react";
import { Badge, StatusBadge } from "../../components/shared/badge";

const meta: Meta<typeof Badge> = {
  title: "Shared/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Active", tone: "success" },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "success", "info", "warning", "danger", "brand"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Success: Story = { args: { tone: "success", children: "Active" } };
export const Info: Story = { args: { tone: "info", children: "Pending" } };
export const Warning: Story = { args: { tone: "warning", children: "Draft" } };
export const Danger: Story = { args: { tone: "danger", children: "Overdue" } };
export const Neutral: Story = { args: { tone: "neutral", children: "Archived" } };
export const Brand: Story = { args: { tone: "brand", children: "Featured" } };

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="info">Info</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="danger">Danger</Badge>
      <Badge tone="brand">Brand</Badge>
    </div>
  ),
};

export const StatusFromDomain: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <StatusBadge status="enrolled" />
      <StatusBadge status="pending" />
      <StatusBadge status="overdue" />
      <StatusBadge status="archived" />
      <StatusBadge status="unknown_status" />
    </div>
  ),
};
