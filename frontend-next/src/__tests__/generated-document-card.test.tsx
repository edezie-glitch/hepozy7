import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  GeneratedDocumentCard,
  parseDocumentFormat,
} from '@/components/chat/generated-document-card';

describe('GeneratedDocumentCard Component', () => {
  it('parses valid document formats cleanly and rejects unknown extensions', () => {
    expect(parseDocumentFormat('report.docx')).toBe('docx');
    expect(parseDocumentFormat('data.pdf')).toBe('pdf');
    expect(parseDocumentFormat('table.xlsx')).toBe('xlsx');
    expect(parseDocumentFormat('records.csv')).toBe('csv');
    expect(parseDocumentFormat('unknown.xyz')).toBeNull();
    expect(parseDocumentFormat(null)).toBeNull();
  });

  it('renders docx download card with format badge, filename, and new-tab download link', () => {
    render(
      <GeneratedDocumentCard
        downloadUrl="/files/hepozy-summary-1234.docx"
        fileName="hepozy-summary.docx"
      />
    );

    expect(screen.getByText('hepozy-summary.docx')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('Generated Document')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('href', '/files/hepozy-summary-1234.docx');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('download');
  });

  it('renders pdf, xlsx, and csv cards with proper format labels', () => {
    const { rerender } = render(
      <GeneratedDocumentCard
        downloadUrl="/files/data-sheet.xlsx"
        fileName="data-sheet.xlsx"
      />
    );
    expect(screen.getByText('XLSX')).toBeInTheDocument();

    rerender(
      <GeneratedDocumentCard
        downloadUrl="/files/invoice.pdf"
        fileName="invoice.pdf"
      />
    );
    expect(screen.getByText('PDF')).toBeInTheDocument();

    rerender(
      <GeneratedDocumentCard
        downloadUrl="/files/records.csv"
        fileName="records.csv"
      />
    );
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('falls back to DOC badge when format is not one of canonical four', () => {
    render(
      <GeneratedDocumentCard
        downloadUrl="/files/custom-doc.txt"
        fileName="custom-doc.txt"
      />
    );

    expect(screen.getByText('custom-doc.txt')).toBeInTheDocument();
    expect(screen.getByText('DOC')).toBeInTheDocument();
  });
});
