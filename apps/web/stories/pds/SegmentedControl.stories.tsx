import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SegmentedControl } from "../../components/pds/composites/segmented-control";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof SegmentedControl> = {
  title: "PDS/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

/** Figma 67:13138 — invoice status filter row. */
export const InvoiceStatus: Story = {
  render: function InvoiceStatusDemo() {
    const [value, setValue] = useState("all");
    return (
      <SegmentedControl
        ariaLabel="Invoice status"
        value={value}
        onChange={setValue}
        options={[
          { id: "all", label: "All" },
          { id: "paid", label: "Paid" },
          { id: "partial", label: "Partial" },
          { id: "due", label: "Due" },
          { id: "overdue", label: "Overdue" },
        ]}
      />
    );
  },
};

export const StructureView: Story = {
  render: function SegmentedDemo() {
    const [value, setValue] = useState("rooms");
    return (
      <SegmentedControl
        ariaLabel="Structure view"
        value={value}
        onChange={setValue}
        options={[
          { id: "rooms", label: "Rooms" },
          { id: "subjects", label: "Subjects" },
          { id: "staff", label: "Staff" },
        ]}
      />
    );
  },
};
