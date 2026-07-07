export const queueNames = {
  invoices: "invoices",
  notifications: "notifications",
  documents: "documents",
  imports: "imports",
  exports: "exports",
  maintenance: "maintenance"
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export type SmsJob =
  | {
      name: "generate-monthly-invoices";
      data: {
        tenantId: string;
        academicYearId: string;
        billingMonth: string;
        triggeredByUserId: string | null;
      };
    }
  | {
      name: "send-email-notification";
      data: {
        tenantId: string;
        templateKey: string;
        recipient: string;
        variables: Record<string, unknown>;
      };
    }
  | {
      name: "render-report-card-pdf";
      data: {
        tenantId: string;
        reportCardId: string;
      };
    }
  | {
      name: "render-payslip-pdf";
      data: {
        tenantId: string;
        payrollRecordId: string;
      };
    }
  | {
      name: "import-students";
      data: {
        tenantId: string;
        fileId: string;
        requestedByUserId: string;
      };
    }
  | {
      name: "purge-archived-records";
      data: Record<string, never>;
    }
  | {
      name: "render-payslip-pdf";
      data: {
        tenantId: string;
        payrollRecordId: string;
      };
    };
