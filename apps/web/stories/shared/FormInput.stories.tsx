import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  InputChip,
  InputChipGroup,
  InputWrapper,
  MobileInput,
  PercentInput,
  TextAreaInput,
  TextInput,
} from "../../components/shared/form-input";

const gradeOptions = [
  { value: "g1", label: "Grade 1" },
  { value: "g2", label: "Grade 2" },
  { value: "g3", label: "Grade 3" },
];

const meta: Meta<typeof TextInput> = {
  title: "Shared/FormInput",
  component: TextInput,
  tags: ["autodocs"],
  args: { placeholder: "Enter value" },
};

export default meta;
type Story = StoryObj<typeof TextInput>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, value: "Read only" } };
export const Error: Story = { args: { inputState: "error", value: "Invalid" } };
export const Completed: Story = { args: { inputState: "completed", value: "Verified" } };

export const WithSuffix: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <TextInput placeholder="10" suffix="MMK / mo" />
    </div>
  ),
};

export const InputWrapperDefault: Story = {
  render: function InputWrapperDemo() {
    const [tags, setTags] = useState(["Grade 1", "Grade 2", "Science"]);
    return (
      <div style={{ width: 320 }}>
        <InputWrapper
          label="Assigned grades"
          htmlFor="grades"
          required
          error={tags.length === 0 ? "Select at least one grade." : undefined}
          hint={tags.length > 0 ? "Students in these grades receive this fee." : undefined}
          link={<a href="#">View grade list</a>}
          chips={
            tags.length ? (
              <InputChipGroup>
                {tags.map((tag) => (
                  <InputChip key={tag} label={tag} onRemove={() => setTags((current) => current.filter((t) => t !== tag))} />
                ))}
              </InputChipGroup>
            ) : null
          }
        >
          <TextInput id="grades" placeholder="Add grade…" />
        </InputWrapper>
      </div>
    );
  },
};

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
      <InputWrapper label="Notes">
        <TextAreaInput placeholder="Optional notes" maxLength={300} languageTag="EN" />
      </InputWrapper>
    </div>
  ),
};

export const TextareaLegacy: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <FormField label="Notes">
        <FormTextarea placeholder="Optional notes" />
      </FormField>
    </div>
  ),
};

export const Mobile: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <InputWrapper label="Phone" required>
        <MobileInput clearable placeholder="9XXXXXXXX" defaultValue="912345678" />
      </InputWrapper>
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
      <TextInput placeholder="Enabled" />
      <TextInput inputState="completed" value="Completed" readOnly />
      <TextInput inputState="error" value="Error state" />
      <TextInput inputState="disabled" value="Disabled" />
    </div>
  ),
  parameters: { layout: "padded" },
};
