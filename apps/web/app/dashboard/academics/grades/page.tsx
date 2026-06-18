import { redirect } from "next/navigation";

export default function LegacyGradesRedirect() {
  redirect("/dashboard/academic-setup/grades-classrooms");
}
