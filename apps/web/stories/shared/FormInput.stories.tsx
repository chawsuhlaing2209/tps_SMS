import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  PercentInput,
} from "../../components/shared/form-input";

const gradeOptions = [
  { value: "g1", label: "Grade 1" },
  { value: "g2", label: "Grade 2" },
  { value: "g3", label: "Grade 3" },
];

const meta: Meta<typeof FormInput> = {
  title: "Shared/FormInput",
  component: FormInput,
  tags: ["autodocs"],
  args: { placeholder: "Enter value" },
};

export default meta;
type Story = StoryObj<typeof FormInput>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, value: "Read only" } };
export const Error: Story = { args: { inputState: "error", value: "Invalid" } };
export const Completed: Story = { args: { inputState: "completed", value: "Verified" } };

export const WithField: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <FormField label="Student name" htmlFor="student-name" required hint="Legal name as on documents">
        <FormInput id="student-name" placeholder="e.g. Maung Maung" />
      </FormField>
    </div>
  ),
};

export const FieldWithError: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <FormField label="Email" htmlFor="email" error="Enter a valid email address">
        <FormInput id="email" type="email" defaultValue="not-an-email" />
      </FormField>
    </div>
  ),
};

export const Textarea: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <FormField label="Notes">
        <FormTextarea placeholder="Optional notes" />
      </FormField>
    </div>
  ),
};

export const Select: Story = {
  render: function SelectField() {
    const [value, setValue] = useState("");
    return (
      <div style={{ width: 320 }}>
        <FormField label="Grade">
          <FormSelect
            options={gradeOptions}
            value={value}
            onValueChange={setValue}
            placeholder="Select grade"
          />
        </FormField>
      </div>
    );
  },
};

export const Percent: Story = {
  render: () => (
    <div style={{ width: 160 }}>
      <FormField label="Discount">
        <PercentInput defaultValue={15} />
      </FormField>
    </div>
  ),
};

export const AllStates: Story = {
  render: () => (
    <div style={{ width: 320, display: "grid", gap: 16 }}>
      <FormInput placeholder="Enabled" />
      <FormInput inputState="completed" value="Completed" readOnly />
      <FormInput inputState="error" value="Error state" />
      <FormInput inputState="disabled" value="Disabled" />
    </div>
  ),
  parameters: { layout: "padded" },
};
