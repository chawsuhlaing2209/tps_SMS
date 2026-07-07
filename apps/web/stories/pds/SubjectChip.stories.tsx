import type { Meta, StoryObj } from "@storybook/react";
import { GradeChip, GradeChipGroup, SubjectChip, SubjectChipGroup } from "../../components/pds";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof SubjectChip> = {
  title: "PDS/SubjectChip",
  component: SubjectChip,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof SubjectChip>;

export const CategoricalSubjects: Story = {
  render: () => (
    <SubjectChipGroup>
      <SubjectChip colorKey="azure">Maths</SubjectChip>
      <SubjectChip colorKey="pomegranate">English</SubjectChip>
      <SubjectChip colorKey="purple">Physics</SubjectChip>
      <SubjectChip colorKey="pink">Chemistry</SubjectChip>
      <SubjectChip colorKey="green">Biology</SubjectChip>
      <SubjectChip colorKey="cyan">Myanmar</SubjectChip>
    </SubjectChipGroup>
  ),
};

export const GradeLetters: Story = {
  render: () => (
    <GradeChipGroup>
      <GradeChip grade="A" />
      <GradeChip grade="B" />
      <GradeChip grade="C" />
      <GradeChip grade="D" />
    </GradeChipGroup>
  ),
};
