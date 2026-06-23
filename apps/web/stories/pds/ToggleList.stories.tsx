import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  ToggleList,
  ToggleListItem,
  ToggleListSectionHead,
} from "../../components/pds/composites/toggle-list";
import { InputWrapper, TextInput } from "../../components/shared/form-input";

const meta: Meta<typeof ToggleList> = {
  title: "PDS/ToggleList",
  component: ToggleList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof ToggleList>;

export const FeeToggles: Story = {
  render: function FeeTogglesStory() {
    const [boarding, setBoarding] = useState(true);
    const [transport, setTransport] = useState(false);

    return (
      <div style={{ maxWidth: 640 }}>
        <ToggleListSectionHead title="Optional services" summary="2 selected" />
        <ToggleList aria-label="Optional services">
          <ToggleListItem
            variant="locked"
            title="Tuition fee"
            description="Required for enrollment"
            amount={600_000}
          />
          <ToggleListItem
            variant="toggle"
            icon="bed"
            iconTone="info"
            title="Boarding fee"
            description="Residential accommodation and meals"
            amount={450_000}
            checked={boarding}
            onCheckedChange={setBoarding}
          />
          <ToggleListItem
            variant="toggle"
            icon="directions_bus"
            iconTone="success"
            title="Transport fee"
            description="School bus service for the academic year"
            amount={80_000}
            checked={transport}
            onCheckedChange={setTransport}
          />
        </ToggleList>
      </div>
    );
  },
};

export const ExpandableEligibility: Story = {
  name: "Expandable (eligibility criteria)",
  render: function ExpandableEligibilityStory() {
    const [sibling, setSibling] = useState(true);
    const [years, setYears] = useState(true);
    const [staff, setStaff] = useState(false);
    const [minSiblings, setMinSiblings] = useState("1");
    const [childPosition, setChildPosition] = useState("");
    const [enrollmentYears, setEnrollmentYears] = useState("2");

    return (
      <div style={{ maxWidth: 640 }}>
        <ToggleList aria-label="Eligibility criteria">
          <ToggleListItem
            variant="expandable"
            icon="family_restroom"
            iconTone="info"
            title="Has enrolled sibling(s)"
            description="Rank determined by enrollment date"
            checked={sibling}
            onCheckedChange={setSibling}
          >
            <div className="pds-toggle-list__expandable-fields">
              <InputWrapper label="Minimum enrolled siblings">
                <TextInput
                  inputMode="numeric"
                  value={minSiblings}
                  onChange={(event) => setMinSiblings(event.target.value)}
                />
              </InputWrapper>
              <InputWrapper label="Exact child position" hint="(optional)">
                <TextInput
                  inputMode="numeric"
                  value={childPosition}
                  onChange={(event) => setChildPosition(event.target.value)}
                  placeholder="e.g. 2 for 2nd child"
                />
              </InputWrapper>
            </div>
          </ToggleListItem>

          <ToggleListItem
            variant="expandable"
            icon="history"
            iconTone="success"
            title={`Enrolled ${enrollmentYears} years`}
            description="Continuous enrollment at the school"
            checked={years}
            onCheckedChange={setYears}
          >
            <InputWrapper label="Years of enrollment">
              <TextInput
                inputMode="numeric"
                min={1}
                value={enrollmentYears}
                onChange={(event) => setEnrollmentYears(event.target.value)}
                suffix="consecutive enrollments"
              />
            </InputWrapper>
          </ToggleListItem>

          <ToggleListItem
            variant="expandable"
            icon="badge"
            iconTone="warning"
            title="Parent is full-time staff"
            description="Verified against HR records"
            checked={staff}
            onCheckedChange={setStaff}
          />
        </ToggleList>
      </div>
    );
  },
};

export const ExpandableStatic: Story = {
  name: "Expandable (expanded)",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <ToggleList aria-label="Eligibility criteria preview">
        <ToggleListItem
          variant="expandable"
          icon="family_restroom"
          iconTone="info"
          title="Has enrolled sibling(s)"
          description="Rank determined by enrollment date"
          checked
        >
          <div className="pds-toggle-list__expandable-fields">
            <InputWrapper label="Minimum enrolled siblings">
              <TextInput inputMode="numeric" defaultValue="1" />
            </InputWrapper>
            <InputWrapper label="Exact child position" hint="(optional)">
              <TextInput placeholder="e.g. 2 for 2nd child" />
            </InputWrapper>
          </div>
        </ToggleListItem>
        <ToggleListItem
          variant="expandable"
          icon="emoji_events"
          iconTone="warning"
          title="Top 3 in grade"
          description="By year-end GPA ranking"
          checked={false}
        />
      </ToggleList>
    </div>
  ),
};
