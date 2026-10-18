'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MessageStreamSkeletonProps {
  className?: string;
}

interface SkeletonConfig {
  type: 'user' | 'assistant';
  bubbleWidth?: string;
  bars?: string[];
}

const DEFAULT_SKELETON_ROWS: SkeletonConfig[] = [
  { type: 'user', bubbleWidth: 'w-52 sm:w-64' },
  { type: 'assistant', bars: ['w-[80%]', 'w-[65%]', 'w-[90%]'] },
  { type: 'user', bubbleWidth: 'w-44 sm:w-56' },
  { type: 'assistant', bars: ['w-[75%]', 'w-[85%]', 'w-[60%]'] },
];

export function MessageStreamSkeleton({ className = '' }: MessageStreamSkeletonProps) {
  return (
    <div
      data-testid="message-stream-skeleton"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('mx-auto flex w-full max-w-3xl flex-col space-y-2', className)}
    >
      <span className="sr-only">Loading conversation history...</span>

      {DEFAULT_SKELETON_ROWS.map((row, idx) => {
        if (row.type === 'user') {
          return (
            <div
              key={`skeleton-user-${idx}`}
              data-testid="user-message-skeleton"
              className="group relative flex w-full flex-col gap-1.5 py-2.5 items-end"
            >
              <div className="flex gap-3 sm:gap-3.5 max-w-[85%] sm:max-w-[78%] flex-row-reverse w-full justify-start">
                <div className="flex flex-col gap-1 min-w-0 items-end">
                  <div
                    data-testid="skeleton-user-bubble"
                    className={`rounded-2xl px-4 py-3 bg-muted/60 dark:bg-muted/40 border border-border/40 shadow-xs animate-pulse ${row.bubbleWidth}`}
                  >
                    <div className="h-4 w-full rounded bg-muted-foreground/20" />
                  </div>
                  <div className="flex items-center justify-end px-1 pt-0.5">
                    <div
                      data-testid="skeleton-timestamp"
                      className="h-2.5 w-10 rounded bg-muted/60 dark:bg-muted/40 animate-pulse"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={`skeleton-assistant-${idx}`}
            data-testid="assistant-message-skeleton"
            className="group relative flex w-full flex-col gap-1.5 py-2.5 items-start"
          >
            <div className="flex gap-3 sm:gap-3.5 w-full max-w-full flex-row">
              <div
                data-testid="skeleton-avatar"
                className="flex h-8 w-8 shrink-0 rounded-full bg-muted/60 dark:bg-muted/40 border border-border/40 shadow-xs mt-0.5 animate-pulse"
              />
              <div className="flex flex-col gap-2 min-w-0 flex-1 px-0 py-0.5">
                <div className="flex flex-col gap-2.5 w-full pt-1">
                  {row.bars?.map((barWidth, barIdx) => (
                    <div
                      key={`bar-${barIdx}`}
                      data-testid="skeleton-shimmer-bar"
                      className={`h-3.5 ${barWidth} rounded bg-muted/60 dark:bg-muted/40 animate-pulse`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-start px-0 pt-1">
                  <div
                    data-testid="skeleton-timestamp"
                    className="h-2.5 w-12 rounded bg-muted/60 dark:bg-muted/40 animate-pulse"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
