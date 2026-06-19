import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Stepper } from "../../components/shared/stepper";

const steps = [
  { id: "student", label: "Student" },
  { id: "placement", label: "Placement" },
  { id: "fees", label: "Fees" },
  { id: "confirm", label: "Confirm" },
];

const meta: Meta<typeof Stepper> = {
  title: "Shared/Stepper",
  component: Stepper,
  tags: ["autodocs"],
  args: {
    steps,
    currentStep: 1,
    ariaLabel: "Enrollment progress",
  },
};

export default meta;
type Story = StoryObj<typeof Stepper>;

export const InProgress: Story = {};
export const FirstStep: Story = { args: { currentStep: 0 } };
export const Completed: Story = { args: { currentStep: 3 } };

export const Interactive: Story = {
  render: function InteractiveStepper() {
    const [currentStep, setCurrentStep] = useState(2);
    return (
      <Stepper
        steps={steps}
        currentStep={currentStep}
        ariaLabel="Enrollment progress"
        onStepClick={setCurrentStep}
      />
    );
  },
  parameters: { layout: "padded" },
};
