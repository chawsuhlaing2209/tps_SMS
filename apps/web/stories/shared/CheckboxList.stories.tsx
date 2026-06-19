import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CheckboxList } from "../../components/shared/checkbox-list";

const feeOptions = [
  {
    id: "tuition",
    label: "Tuition fee",
    description: "Core academic fee, billed each term",
    amount: 600_000,
  },
  {
    id: "boarding",
    label: "Boarding fee",
    description: "Residential accommodation and meals",
    amount: 450_000,
  },
  {
    id: "transport",
    label: "Transport fee",
    description: "School bus service for the academic year",
    amount: 80_000,
  },
  {
    id: "lab",
    label: "Lab fee",
    description: "Science and practical lab materials",
    amount: 50_000,
  },
  {
    id: "lunch",
    label: "Lunch fee",
    description: "Daily meal plan on school days",
    amount: 120_000,
  },
  {
    id: "activities",
    label: "Activities fee",
    description: "Clubs, sports, and enrichment programs",
    amount: 30_000,
  },
];

const gradeOptions = [
  { id: "g1", label: "Grade 1" },
  { id: "g2", label: "Grade 2" },
  { id: "g3", label: "Grade 3" },
  { id: "g4", label: "Grade 4" },
];

const meta: Meta<typeof CheckboxList> = {
  title: "Shared/CheckboxList",
  component: CheckboxList,
  tags: ["autodocs"],
  args: {
    title: "Fee components",
    options: feeOptions,
    selectedIds: ["tuition", "boarding", "transport"],
    onChange: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof CheckboxList>;

export const FeeComponents: Story = {};

export const Interactive: Story = {
  render: function InteractiveCheckboxList() {
    const [selectedIds, setSelectedIds] = useState<string[]>(["tuition", "boarding"]);
    return (
      <div style={{ maxWidth: 640 }}>
        <CheckboxList
          title="Fee components"
          options={feeOptions}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      </div>
    );
  },
};

export const SimpleList: Story = {
  args: {
    title: "Grade levels",
    options: gradeOptions,
    selectedIds: ["g1"],
    showTotal: false,
  },
};

export const Empty: Story = {
  args: {
    options: [],
    selectedIds: [],
    emptyTitle: "No grades configured yet.",
  },
};

export const Disabled: Story = {
  args: { disabled: true, selectedIds: ["tuition", "lab"] },
};
