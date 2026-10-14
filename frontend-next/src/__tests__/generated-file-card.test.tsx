import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratedFileCard } from '@/components/chat/generated-file-card';

describe('GeneratedFileCard Component', () => {
  it('renders docx download card with format badge, filename, and new-tab download link', () => {
    render(
      <GeneratedFileCard
        downloadUrl="/files/hepozy-summary-1234.docx"
        fileName="hepozy-summary.docx"
      />
    );

    expect(screen.getByText('hepozy-summary.docx')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('href', '/files/hepozy-summary-1234.docx');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('download', 'hepozy-summary.docx');
  });

  it('renders pdf, xlsx, and csv cards with proper format labels', () => {
    const { rerender } = render(
      <GeneratedFileCard
        downloadUrl="/files/data-sheet.xlsx"
        fileName="data-sheet.xlsx"
      />
    );
    expect(screen.getByText('XLSX')).toBeInTheDocument();

    rerender(
      <GeneratedFileCard
        downloadUrl="/files/invoice.pdf"
        fileName="invoice.pdf"
      />
    );
    expect(screen.getByText('PDF')).toBeInTheDocument();

    rerender(
      <GeneratedFileCard
        downloadUrl="/files/records.csv"
        fileName="records.csv"
      />
    );
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('falls back gracefully when filename is omitted', () => {
    render(<GeneratedFileCard downloadUrl="/files/export-abc" />);

    expect(screen.getByText('Generated Document')).toBeInTheDocument();
    expect(screen.getByText('FILE')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('href', '/files/export-abc');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
