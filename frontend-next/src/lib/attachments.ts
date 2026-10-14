/**
 * Hepozy Attachment Utilities
 * Handles validation, encoding, and previewing of user-uploaded document and image attachments.
 * Follows the domain definition in CONTEXT.md:
 * Attachment: A user-uploaded document or image accompanying a message for text extraction or visual understanding.
 */

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_DOC_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.csv',
  '.xlsx',
] as const;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

export const ACCEPTED_FILE_EXTENSIONS = [
  ...ALLOWED_DOC_EXTENSIONS,
  ...ALLOWED_IMAGE_EXTENSIONS,
].join(',');

export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
}

export interface SerializedAttachment {
  [key: string]: unknown;
  name: string;
  type: string;
  data: string;
}

export type AttachmentPayload = SerializedAttachment;

export interface StagedAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  isImage: boolean;
}

/**
 * Checks whether a given file or mime type represents an image.
 */
export function isImageFile(fileOrType: { type?: string; name?: string } | string): boolean {
  if (typeof fileOrType === 'string') {
    const lower = fileOrType.toLowerCase();
    return (
      lower.startsWith('image/') ||
      ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
    );
  }
  const type = (fileOrType.type || '').toLowerCase();
  const name = (fileOrType.name || '').toLowerCase();
  return (
    type.startsWith('image/') ||
    ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}

/**
 * Validates file size and allowed extension/type.
 */
export function validateAttachment(file: File): AttachmentValidationResult {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: `${file.name} is over 5 MB`,
    };
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  const isDoc = ALLOWED_DOC_EXTENSIONS.some((ext) => name.endsWith(ext));
  const isImage =
    ALLOWED_IMAGE_TYPES.some((imgType) => type === imgType) ||
    ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!isDoc && !isImage) {
    return {
      valid: false,
      error: `${file.name}: this file type is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Serializes a File into a base64 SerializedAttachment suitable for FastAPI /chat.
 */
export function serializeAttachment(file: File): Promise<SerializedAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: base64Data,
      });
    };
    reader.onerror = () => {
      reject(new Error(`Failed to read attachment ${file.name}`));
    };
    reader.readAsDataURL(file);
  });
}

export const fileToAttachmentPayload = serializeAttachment;
