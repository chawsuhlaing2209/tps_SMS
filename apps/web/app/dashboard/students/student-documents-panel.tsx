"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ApiError, apiUpload, useApiMutation, useApiQuery } from "../../lib/api";
import { getSession } from "../../lib/session";
import { Icon } from "../../lib/material-icon";
import { toastError, toastSuccess } from "../../lib/toast";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export type StudentDocument = {
  id: string;
  fileId: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  verifiedAt: string | null;
};

function formatFileSize(bytes: number | null) {
  if (!bytes) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentDocumentsPanel({
  studentId,
  canManage
}: {
  studentId: string;
  canManage: boolean;
}) {
  const t = useTranslations("students");
  const c = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const documents = useApiQuery<StudentDocument[]>(
    (tenant) => `/tenants/${tenant}/students/${studentId}/documents`
  );

  const deleteDocument = useApiMutation<{ documentId: string }, { ok: boolean }>(
    ({ documentId }, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/documents/${documentId}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_, tenant) => [`/tenants/${tenant}/students/${studentId}/documents`],
      successMessage: t("documentsDeleteSuccess"),
      showSuccessToast: true
    }
  );

  async function uploadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toastError(t("documentsUploadTooLarge"));
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      toastError(t("documentsUploadTypeError"));
      return;
    }

    setUploading(true);
    try {
      const session = getSession();
      if (!session?.tenantId) {
        throw new ApiError("Not signed in.", 401);
      }
      await apiUpload<StudentDocument>(
        `/tenants/${session.tenantId}/students/${studentId}/documents`,
        file
      );
      toastSuccess(t("documentsUploadSuccess"));
      await documents.refetch();
    } catch (error) {
      toastError(error instanceof ApiError ? error.message : c("somethingWrong"));
    } finally {
      setUploading(false);
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await uploadFile(file);
  };

  const handleDownload = async (documentId: string) => {
    const session = getSession();
    const tenantId = session?.tenantId;
    if (!tenantId) {
      return;
    }
    const headers = new Headers();
    if (session?.userId) {
      headers.set("x-user-id", session.userId);
    }
    const response = await fetch(
      `/api/tenants/${tenantId}/students/${studentId}/documents/${documentId}/file`,
      { credentials: "include", headers }
    );
    if (!response.ok) {
      toastError(c("somethingWrong"));
      return;
    }
    const blob = await response.blob();
    const doc = documents.data?.find((item) => item.id === documentId);
    const filename = doc?.originalFilename ?? "document";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const hasDocuments = Boolean(documents.data?.length);
  const showEmptyDropzone =
    !documents.isLoading && !documents.isError && !hasDocuments;
  const loadError =
    documents.error instanceof ApiError ? documents.error.message : null;

  function openFilePicker() {
    if (!canManage || uploading) {
      return;
    }
    fileInputRef.current?.click();
  }

  return (
    <div className="panel student-documents-panel">
      <h2 className="pds-type-title-s-extrabold student-documents-panel__title">{t("tabDocuments")}</h2>

      {canManage ? (
        <input
          ref={fileInputRef}
          type="file"
          className="student-documents-panel__file-input"
          accept={ACCEPT_ATTR}
          onChange={(event) => void handleFileChange(event)}
        />
      ) : null}

      {documents.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : null}

      {documents.isError ? (
        <div className="student-documents-panel__error">
          <p className="pds-type-body-m-medium error-text" role="alert">
            {loadError ?? c("somethingWrong")}
          </p>
        </div>
      ) : null}

      {!documents.isLoading && !documents.isError && hasDocuments ? (
        <ul className="student-documents-panel__list">
          {documents.data!.map((doc) => (
            <li key={doc.id} className="student-documents-panel__row">
              <div className="student-documents-panel__row-icon" aria-hidden="true">
                <Icon name="description" />
              </div>
              <div className="student-documents-panel__row-main">
                <strong className="pds-type-body-m-bold">
                  {doc.originalFilename ?? t("documentsUntitled")}
                </strong>
                <span className="pds-type-body-s-regular student-documents-panel__row-meta">
                  {formatFileSize(doc.sizeBytes)} ·{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  }).format(new Date(doc.createdAt))}
                </span>
              </div>
              <div className="student-documents-panel__actions">
                <button
                  type="button"
                  className="pds-type-body-s-regular row-action"
                  onClick={() => void handleDownload(doc.id)}
                >
                  {t("documentsDownload")}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    className="pds-type-body-s-regular row-action row-action--danger"
                    disabled={deleteDocument.isPending}
                    onClick={() => void deleteDocument.mutateAsync({ documentId: doc.id })}
                  >
                    {c("delete")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmptyDropzone ? (
        <div
          className={`student-documents-dropzone${dragActive ? " student-documents-dropzone--active" : ""}${canManage ? " student-documents-dropzone--interactive" : ""}`}
          onDragEnter={(event) => {
            if (!canManage) {
              return;
            }
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            if (!canManage) {
              return;
            }
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            if (!canManage) {
              return;
            }
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            if (!canManage) {
              return;
            }
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void uploadFile(file);
            }
          }}
        >
          <span className="student-documents-dropzone__icon-wrap" aria-hidden="true">
            <Icon name="cloud_upload" size={26} />
          </span>
          <p className="pds-type-title-xs-bold student-documents-dropzone__title">
            {t("documentsEmptyTitle")}
          </p>
          <p className="pds-type-body-s-regular student-documents-dropzone__help">
            {t("documentsEmptyHelp")}
          </p>
          {canManage ? (
            <button
              type="button"
              className="pds-type-body-m-bold btn-primary student-documents-dropzone__cta"
              disabled={uploading}
              onClick={openFilePicker}
            >
              <Icon name="upload" size={17} />
              {uploading ? c("loading") : t("uploadFile")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!documents.isLoading && !documents.isError && hasDocuments && canManage ? (
        <div
          className={`student-documents-dropzone student-documents-dropzone--compact${dragActive ? " student-documents-dropzone--active" : ""} student-documents-dropzone--interactive`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void uploadFile(file);
            }
          }}
        >
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary student-documents-dropzone__cta"
            disabled={uploading}
            onClick={openFilePicker}
          >
            <Icon name="upload" size={17} />
            {uploading ? c("loading") : t("uploadFile")}
          </button>
          <p className="pds-type-body-s-regular student-documents-dropzone__hint">
            {t("documentsUploadHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
