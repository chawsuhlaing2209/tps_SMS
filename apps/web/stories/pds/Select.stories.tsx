import { Meta, StoryObj } from "@storybook/react";
import { PdsSelect } from "../../components/pds/composites/select";

const items = [
  { id: "1", label: "Grade 1" },
  { id: "2", label: "Grade 2" },
  { id: "3", label: "Grade 3" },
  { id: "4", label: "Grade 4" },
  { id: "5", label: "Grade 5" },
  { id: "6", label: "Grade 6" },
  { id: "7", label: "Grade 7" },
];

const meta: Meta<typeof PdsSelect> = {
  title: "PDS/Composites/Select",
  component: PdsSelect,
  tags: ["autodocs"],
  args: {
    items,
    variant: "form",
    state: "idle",
    placeholder: "Select",
    multiple: false,
    searchable: false,
    optionVariant: "default",
    hasFooter: false,
  },
};

export default meta;
type Story = StoryObj<typeof PdsSelect>;

export const FormIdle: Story = {};
export const FormSelected: Story = { args: { value: "2" } };
export const FormError: Story = { args: { state: "error", value: "2" } };
export const FormDisabled: Story = { args: { state: "disabled" } };
export const FilterIdle: Story = { args: { variant: "filter" } };
export const FilterSelected: Story = {
  args: { variant: "filter", value: "2" },
};
export const FilterInteractive: Story = {
  args: { variant: "filter", placeholder: "Select" },
};
export const RadioOptions: Story = {
  args: { state: "focus", optionVariant: "radio", hasFooter: true },
};
export const CheckboxMulti: Story = {
  args: { multiple: true, optionVariant: "checkbox", value: ["1", "3"] },
};
