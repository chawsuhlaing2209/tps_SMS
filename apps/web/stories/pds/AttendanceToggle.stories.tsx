import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AttendanceToggle, AttendanceToggleGroup } from "../../components/pds/subcomponents/attendance-toggle";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof AttendanceToggle> = {
  title: "PDS/AttendanceToggle",
  component: AttendanceToggle,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof AttendanceToggle>;

export const Interactive: Story = {
  render: function AttendanceDemo() {
    const [value, setValue] = useState("present");
    return (
      <AttendanceToggleGroup>
        <AttendanceToggle
          state="present"
          label="Present"
          selected={value === "present"}
          onClick={() => setValue("present")}
        />
        <AttendanceToggle
          state="late"
          label="Late"
          selected={value === "late"}
          onClick={() => setValue("late")}
        />
        <AttendanceToggle
          state="absent"
          label="Absent"
          selected={value === "absent"}
          onClick={() => setValue("absent")}
        />
      </AttendanceToggleGroup>
    );
  },
};
