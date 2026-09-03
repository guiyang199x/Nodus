import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_BATCH = 20;
export const DOCUMENT_ORIGINALS_BUCKET = 'originals';
export const ALLOWED_UPLOADS = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.md': ['text/markdown', 'text/plain'],
  '.txt': ['text/plain'],
} as const;

export const UploadFileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES, '单文件不能超过 50 MB'),
    declaredMime: z.string().trim().min(1),
  })
  .superRefine((file, context) => {
    const suffix = file.name
      .slice(file.name.lastIndexOf('.'))
      .toLowerCase() as keyof typeof ALLOWED_UPLOADS;
    const allowed = ALLOWED_UPLOADS[suffix] as readonly string[] | undefined;
    if (!allowed?.includes(file.declaredMime)) {
      context.addIssue({ code: 'custom', message: '不支持此文件格式' });
    }
  });
export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

export const CreateUploadSessionsInputSchema = z.object({
  workspaceId: z.string().uuid(),
  files: z.array(UploadFileInputSchema).min(1).max(MAX_UPLOAD_BATCH, '单批最多上传 20 个文件'),
});
export type CreateUploadSessionsInput = z.infer<typeof CreateUploadSessionsInputSchema>;

export const UploadSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  objectPath: z.string().min(1),
  uploadToken: z.string().min(1),
  // PostgREST renders timestamptz with a numeric offset (+00:00), not a Z
  // suffix, and plain .datetime() rejects offsets.
  expiresAt: z.string().datetime({ offset: true }),
});
export type UploadSession = z.infer<typeof UploadSessionSchema>;

export function parseUploadBatch(input: unknown): CreateUploadSessionsInput {
  return CreateUploadSessionsInputSchema.parse(input);
}
