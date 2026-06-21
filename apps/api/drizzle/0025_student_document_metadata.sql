ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "original_filename" text;
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "size_bytes" integer;
