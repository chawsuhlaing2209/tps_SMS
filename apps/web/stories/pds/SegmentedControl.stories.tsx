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
