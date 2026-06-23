import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { studentDocuments, students } from "../db/schema.js";
import { S3StorageService } from "../storage/s3-storage.service.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function documentStorageKey(tenantId: string, studentId: string, documentId: string): string {
  return `tenants/${tenantId}/students/${studentId}/documents/${documentId}`;
}

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class StudentDocumentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: S3StorageService,
    private readonly auditService: AuditService
  ) {}

  async list(tenantId: string, studentId: string) {
    await this.assertStudent(tenantId, studentId);

    const rows = await this.db
      .select({
        id: studentDocuments.id,
        fileId: studentDocuments.fileId,
        originalFilename: studentDocuments.originalFilename,
        mimeType: studentDocuments.mimeType,
        sizeBytes: studentDocuments.sizeBytes,
        createdAt: studentDocuments.createdAt,
        verifiedAt: studentDocuments.verifiedAt
      })
      .from(studentDocuments)
      .where(
        and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, studentId))
      )
      .orderBy(desc(studentDocuments.createdAt));

    return rows;
  }

  async upload(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    file: UploadFile
  ) {
    await this.assertStudent(tenantId, studentId);
    this.validateUpload(file);

    const documentId = randomUUID();
    const fileId = randomUUID();
    const storageKey = documentStorageKey(tenantId, studentId, documentId);

    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const [created] = await this.db
      .insert(studentDocuments)
      .values({
        id: documentId,
        tenantId,
        studentId,
        fileId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        createdBy: actorUserId ?? null,
        updatedBy: actorUserId ?? null
      })
      .returning({
        id: studentDocuments.id,
        fileId: studentDocuments.fileId,
        originalFilename: studentDocuments.originalFilename,
        mimeType: studentDocuments.mimeType,
        sizeBytes: studentDocuments.sizeBytes,
        createdAt: studentDocuments.createdAt,
        verifiedAt: studentDocuments.verifiedAt
      });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "created",
      recordType: "student_document",
      recordId: created!.id,
      after: {
        studentId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      }
    });

    return created!;
  }

  async download(tenantId: string, studentId: string, documentId: string): Promise<StreamableFile> {
    const row = await this.getDocumentOrThrow(tenantId, studentId, documentId);
    const storageKey = documentStorageKey(tenantId, studentId, documentId);
    const buffer = await this.storage.getObject(storageKey);

    return new StreamableFile(buffer, {
      type: row.mimeType ?? "application/octet-stream",
      disposition: `attachment; filename="${encodeURIComponent(row.originalFilename ?? "document")}"`
    });
  }

  async delete(
    tenantId: string,
    studentId: string,
    documentId: string,
    actorUserId: string | undefined
  ) {
    const row = await this.getDocumentOrThrow(tenantId, studentId, documentId);

    await this.db
      .delete(studentDocuments)
      .where(
        and(
          eq(studentDocuments.tenantId, tenantId),
          eq(studentDocuments.id, documentId),
          eq(studentDocuments.studentId, studentId)
        )
      );

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "deleted",
      recordType: "student_document",
      recordId: documentId,
      before: {
        studentId,
        originalFilename: row.originalFilename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes
      }
    });

    return { ok: true };
  }

  private validateUpload(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("No file uploaded.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException("File exceeds the 5 MB limit.");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("File type not allowed. Use PDF, JPEG, PNG, or WebP.");
    }
  }

  private async assertStudent(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .limit(1);

    if (!student) {
      throw new NotFoundException("Student not found.");
    }
  }

  private async getDocumentOrThrow(tenantId: string, studentId: string, documentId: string) {
    const [row] = await this.db
      .select({
        id: studentDocuments.id,
        originalFilename: studentDocuments.originalFilename,
        mimeType: studentDocuments.mimeType,
        sizeBytes: studentDocuments.sizeBytes
      })
      .from(studentDocuments)
      .where(
        and(
          eq(studentDocuments.tenantId, tenantId),
          eq(studentDocuments.studentId, studentId),
          eq(studentDocuments.id, documentId)
        )
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Document not found.");
    }

    return row;
  }
}
