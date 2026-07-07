import type { ReactNode } from "react";
import { FinanceYearBar, FinanceYearProvider } from "./finance-year-context";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <FinanceYearProvider>
      <FinanceYearBar />
      {children}
    </FinanceYearProvider>
  );
}
