import type { Meta, StoryObj } from "@storybook/react";
import { PdsBreadcrumb } from "../../components/pds/composites/breadcrumb";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof PdsBreadcrumb> = {
  title: "PDS/Breadcrumb",
  component: PdsBreadcrumb,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof PdsBreadcrumb>;

export const TwoItems: Story = {
  args: {
    items: [
      { label: "School", href: "/dashboard" },
      { label: "Teachers" },
    ],
  },
};

export const ThreeItems: Story = {
  args: {
    items: [
      { label: "School", href: "/dashboard" },
      { label: "Teachers", href: "/dashboard/teachers" },
      { label: "Chaw Su Hlaing" },
    ],
  },
};

export const FiveItems: Story = {
  args: {
    items: [
      { label: "Business", href: "/dashboard/finance" },
      { label: "Fees & Billing", href: "/dashboard/finance/invoices" },
      { label: "Invoices", href: "/dashboard/finance/invoices" },
      { label: "Grade 11", href: "/dashboard/finance/invoices/grade/1" },
      { label: "INV-2026-0042" },
    ],
  },
};
