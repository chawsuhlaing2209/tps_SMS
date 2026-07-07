import { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

const meta: Meta = {
  title: "UI/Tabs",
  tags: ["autodocs"],
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div style={{ width: 420 }}>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="family">Family</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p>Student overview content.</p>
        </TabsContent>
        <TabsContent value="invoices">
          <p>Billing and invoice history.</p>
        </TabsContent>
        <TabsContent value="family">
          <p>Guardians and household links.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
