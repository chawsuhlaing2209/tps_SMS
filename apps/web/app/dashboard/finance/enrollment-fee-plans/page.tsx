import { redirect } from "next/navigation";

export default function EnrollmentFeePlansRedirectPage() {
  redirect("/dashboard/finance/fee-structures");
}
