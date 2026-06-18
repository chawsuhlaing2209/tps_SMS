import { redirect } from "next/navigation";

export default function GradesSetupRedirectPage() {
  redirect("/dashboard/academic-setup/grades-classrooms");
}
