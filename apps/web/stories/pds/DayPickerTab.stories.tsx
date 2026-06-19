import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DayPickerGroup, DayPickerTab } from "../../components/pds/composites/filter-tabs";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof DayPickerTab> = {
  title: "PDS/DayPickerTab",
  component: DayPickerTab,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof DayPickerTab>;

export const EmphasisFilter: Story = {
  render: function DayPickerDemo() {
    const [active, setActive] = useState("term");
    return (
      <DayPickerGroup>
        <DayPickerTab label="Mon" active={active === "mon"} onClick={() => setActive("mon")} />
        <DayPickerTab label="Tue" active={active === "tue"} onClick={() => setActive("tue")} />
        <DayPickerTab label="Wed" active={active === "wed"} onClick={() => setActive("wed")} />
        <DayPickerTab
          label="This term"
          emphasis
          active={active === "term"}
          onClick={() => setActive("term")}
        />
        <DayPickerTab label="All year" active={active === "year"} onClick={() => setActive("year")} />
      </DayPickerGroup>
    );
  },
};
