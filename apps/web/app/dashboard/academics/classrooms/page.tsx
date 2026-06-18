import { redirect } from 'next/navigation';

export default function LegacyRedirect() {
  redirect('/dashboard/academic-setup/classrooms');
}
