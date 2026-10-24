'use client';

import * as React from 'react';
import { Download, FileText, FileSpreadsheet, ExternalLink } from 'lucide-react';

export type GeneratedDocumentFormat = 'docx' | 'pdf' | 'xlsx' | 'csv';

export interface GeneratedDocumentCardProps {
  downloadUrl: string;
  fileName: string;
  className?: string;
}

export function parseDocumentFormat(fileName?: string | null): GeneratedDocumentFormat | null {
  if (!fileName) return null;
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim().toLowerCase());
  if (!match) return null;
  const ext = match[1];
  if (ext === 'docx' || ext === 'pdf' || ext === 'xlsx' || ext === 'csv') {
    return ext;
  }
  return null;
}

export function GeneratedDocumentCard({
  downloadUrl,
  fileName,
  className = '',
}: GeneratedDocumentCardProps) {
  const format = parseDocumentFormat(fileName);

  const { formatLabel, IconComponent, badgeColor } = React.useMemo(() => {
    switch (format) {
      case 'docx':
        return {
          formatLabel: 'DOCX',
          IconComponent: FileText,
          badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'pdf':
        return {
          formatLabel: 'PDF',
          IconComponent: FileText,
          badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      case 'xlsx':
        return {
          formatLabel: 'XLSX',
          IconComponent: FileSpreadsheet,
          badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'csv':
        return {
          formatLabel: 'CSV',
          IconComponent: FileSpreadsheet,
          badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
      default:
        return {
          formatLabel: 'DOC',
          IconComponent: FileText,
          badgeColor: 'bg-primary/10 text-primary border-primary/20',
        };
    }
  }, [format]);

  return (
    <div
      data-testid="generated-document-card"
      className={`mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 dark:bg-primary/5 dark:border-primary/40 p-3 sm:p-3.5 shadow-xs transition-all hover:border-primary/50 w-full min-w-0 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Document Format Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30 shadow-xs">
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Document Information */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {fileName}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase border ${badgeColor}`}
            >
              {formatLabel}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Generated Document</span>
        </div>
      </div>

      {/* Prominent Orange Download Action opening in a new tab */}
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Download ${fileName}`}
        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4" />
        <span>Download</span>
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    </div>
  );
}
