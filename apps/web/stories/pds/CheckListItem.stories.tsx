import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CheckListItem } from "../../components/pds/subcomponents/check-list-item";

const meta: Meta<typeof CheckListItem> = {
  title: "PDS/CheckListItem",
  component: CheckListItem,
  tags: ["autodocs"],
  args: {
    label: "Tuition fee",
    description: "Core academic fee, billed each term",
    trailing: "600,000",
    checked: false,
    onCheckedChange: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof CheckListItem>;

export const Unselected: Story = {};

export const Selected: Story = {
  args: { checked: true },
};

export const WithoutDescription: Story = {
  args: {
    label: "Grade 1",
    description: undefined,
    trailing: undefined,
  },
};

export const InteractiveList: Story = {
  render: function InteractiveList() {
    const [selected, setSelected] = useState<string[]>(["tuition"]);
    const items = [
      {
        id: "tuition",
        label: "Tuition fee",
        description: "Core academic fee, billed each term",
        trailing: "600,000",
      },
      {
        id: "boarding",
        label: "Boarding fee",
        description: "Residential accommodation and meals",
        trailing: "450,000",
      },
      {
        id: "transport",
        label: "Transport fee",
        description: "School bus service for the academic year",
        trailing: "80,000",
      },
    ];

    return (
      <div
        style={{
          border: "1px solid var(--pds-border-color-primary)",
          borderRadius: 8,
          maxWidth: 640,
          overflow: "hidden",
        }}
      >
        {items.map((item) => (
          <CheckListItem
            key={item.id}
            id={`story-${item.id}`}
            label={item.label}
            description={item.description}
            trailing={item.trailing}
            checked={selected.includes(item.id)}
            onCheckedChange={(checked) =>
              setSelected((prev) =>
                checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
              )
            }
          />
        ))}
      </div>
    );
  },
};
