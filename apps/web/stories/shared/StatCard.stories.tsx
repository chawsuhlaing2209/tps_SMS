import { Meta, StoryObj } from "@storybook/react";
import { Icon } from "../../app/lib/material-icon";
import { StatCard, StatGrid } from "../../components/shared/stat-card";

const meta: Meta<typeof StatCard> = {
  title: "Shared/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  args: {
    label: "Outstanding balance",
    value: "1,250,000 MMK",
    hint: "12 invoices due",
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {};
export const Accent: Story = {
  args: {
    accent: true,
    label: "Collected today",
    value: "450,000 MMK",
    icon: <Icon name="payments" size={20} />,
  },
};

export const Dark: Story = {
  args: {
    dark: true,
    label: "Total paid",
    value: "1,436,000",
    hint: "MMK",
  },
};

export const Layout: Story = {
  args: {
    layout: true,
    label: "Outstanding",
    value: "80,000",
    hint: "MMK",
  },
};

export const Grid: Story = {
  render: () => (
    <StatGrid>
      <StatCard label="Students" value="248" />
      <StatCard label="Enrolled" value="231" accent />
      <StatCard layout label="Outstanding" value="3.2M" hint="MMK" />
      <StatCard dark label="Total paid" value="1.4M" hint="MMK" />
    </StatGrid>
  ),
  parameters: { layout: "padded" },
};
