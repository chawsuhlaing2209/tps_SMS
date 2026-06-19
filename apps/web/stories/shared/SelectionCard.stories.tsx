import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Icon } from "../../app/lib/material-icon";
import { SelectionCard, SelectionCardGrid } from "../../components/shared/selection-card";

const meta: Meta<typeof SelectionCard> = {
  title: "Shared/SelectionCard",
  component: SelectionCard,
  tags: ["autodocs"],
  args: {
    icon: <Icon name="person_add" size={24} />,
    title: "New student",
    description: "Register a brand-new student record.",
  },
};

export default meta;
type Story = StoryObj<typeof SelectionCard>;

export const Unselected: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };

export const Grid: Story = {
  render: function SelectionCardDemo() {
    const [mode, setMode] = useState("new");
    return (
      <SelectionCardGrid>
        <SelectionCard
          icon={<Icon name="person_add" size={24} />}
          title="New student"
          description="Create a fresh student profile."
          selected={mode === "new"}
          onClick={() => setMode("new")}
        />
        <SelectionCard
          icon={<Icon name="group_add" size={24} />}
          title="Existing student"
          description="Enroll someone already in the directory."
          selected={mode === "existing"}
          onClick={() => setMode("existing")}
        />
      </SelectionCardGrid>
    );
  },
  parameters: { layout: "padded" },
};
