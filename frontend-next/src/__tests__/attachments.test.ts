import { describe, it, expect } from 'vitest';
import {
  validateAttachment,
  serializeAttachment,
  fileToAttachmentPayload,
  isImageFile,
  MAX_ATTACHMENT_SIZE,
} from '@/lib/attachments';

describe('Attachment Utilities & Validation', () => {
  it('validates allowed document file types under 5MB', () => {
    const validDocs = [
      new File(['test content'], 'sample.pdf', { type: 'application/pdf' }),
      new File(['test content'], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      new File(['test content'], 'data.txt', { type: 'text/plain' }),
      new File(['col1,col2\n1,2'], 'report.csv', { type: 'text/csv' }),
      new File(['binary content'], 'sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ];

    for (const file of validDocs) {
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('validates allowed image file types under 5MB', () => {
    const validImages = [
      new File(['img bytes'], 'photo.png', { type: 'image/png' }),
      new File(['img bytes'], 'banner.jpg', { type: 'image/jpeg' }),
      new File(['img bytes'], 'graphic.jpeg', { type: 'image/jpeg' }),
      new File(['img bytes'], 'avatar.webp', { type: 'image/webp' }),
    ];

    for (const file of validImages) {
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(isImageFile(file)).toBe(true);
    }
  });

  it('rejects unaccepted file extensions with clear error notification', () => {
    const invalidFiles = [
      new File(['evil code'], 'malware.exe', { type: 'application/x-msdownload' }),
      new File(['<script></script>'], 'index.html', { type: 'text/html' }),
      new File(['import os'], 'script.py', { type: 'text/x-python' }),
      new File(['zip contents'], 'archive.zip', { type: 'application/zip' }),
      new File(['markdown'], 'doc.md', { type: 'text/markdown' }),
    ];

    for (const file of invalidFiles) {
      const result = validateAttachment(file);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/this file type is not supported/i);
    }
  });

  it('rejects files exceeding 5MB with clear error notification', () => {
    const largeContent = new Uint8Array(MAX_ATTACHMENT_SIZE + 1024);
    const oversizedFile = new File([largeContent], 'huge-document.pdf', {
      type: 'application/pdf',
    });

    const result = validateAttachment(oversizedFile);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5\s*MB/i);
  });

  it('encodes file into base64 { name, type, data } payload structure', async () => {
    const content = 'Hello Hepozy attachment test';
    const testFile = new File([content], 'greeting.txt', { type: 'text/plain' });

    const payload = await serializeAttachment(testFile);
    const aliasPayload = await fileToAttachmentPayload(testFile);

    expect(payload.name).toBe('greeting.txt');
    expect(payload.type).toBe('text/plain');
    expect(typeof payload.data).toBe('string');
    expect(aliasPayload).toEqual(payload);
    // Base64 decode to verify content matches
    const decoded = atob(payload.data);
    expect(decoded).toBe('Hello Hepozy attachment test');
  });
});
