import { Meta, StoryObj } from "@storybook/react";
import { Separator } from "../../components/ui/separator";

const meta: Meta<typeof Separator> = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <p>Section one</p>
      <Separator className="my-4" />
      <p>Section two</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", height: 32, gap: 12 }}>
      <span>Invoices</span>
      <Separator orientation="vertical" />
      <span>Payments</span>
    </div>
  ),
};
