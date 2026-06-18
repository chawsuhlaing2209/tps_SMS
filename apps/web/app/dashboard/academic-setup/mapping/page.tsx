import { redirect } from "next/navigation";

export default function LegacyMappingRedirect() {
  redirect("/dashboard/academic-setup/subjects");
}
