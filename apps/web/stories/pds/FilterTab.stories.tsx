import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FilterTab, FilterTabGroup } from "../../components/pds/composites/filter-tabs";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof FilterTab> = {
  title: "PDS/FilterTab",
  component: FilterTab,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof FilterTab>;

export const WithCounts: Story = {
  render: function FilterDemo() {
    const [active, setActive] = useState("teachers");
    return (
      <FilterTabGroup>
        <FilterTab
          label="Teachers"
          count={24}
          active={active === "teachers"}
          onClick={() => setActive("teachers")}
        />
        <FilterTab
          label="Students"
          count={612}
          active={active === "students"}
          onClick={() => setActive("students")}
        />
        <FilterTab
          label="Guardians"
          count={318}
          active={active === "guardians"}
          onClick={() => setActive("guardians")}
        />
      </FilterTabGroup>
    );
  },
};
