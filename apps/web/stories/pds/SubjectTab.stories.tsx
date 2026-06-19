import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SubjectTab, SubjectTabGroup } from "../../components/pds/composites/filter-tabs";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof SubjectTab> = {
  title: "PDS/SubjectTab",
  component: SubjectTab,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof SubjectTab>;

export const CategoricalTabs: Story = {
  render: function SubjectTabDemo() {
    const [active, setActive] = useState("maths");
    return (
      <SubjectTabGroup>
        <SubjectTab
          label="Maths"
          colorKey="azure"
          active={active === "maths"}
          onClick={() => setActive("maths")}
        />
        <SubjectTab
          label="English"
          colorKey="pomegranate"
          active={active === "english"}
          onClick={() => setActive("english")}
        />
        <SubjectTab
          label="Physics"
          colorKey="purple"
          active={active === "physics"}
          onClick={() => setActive("physics")}
        />
        <SubjectTab
          label="Myanmar"
          colorKey="cyan"
          active={active === "myanmar"}
          onClick={() => setActive("myanmar")}
        />
      </SubjectTabGroup>
    );
  },
};
