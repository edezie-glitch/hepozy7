'use client';

import * as React from 'react';
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatQuotaResetCountdown } from '@/lib/quota';
import { Clock, ShieldAlert, X } from 'lucide-react';

export interface QuotaExceededModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotaResetAt?: string | null;
}

export function QuotaExceededModal({
  open,
  onOpenChange,
  quotaResetAt,
}: QuotaExceededModalProps) {
  // Normalize Base UI's (open: boolean, details: any) to unary (open: boolean)
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const countdownText = React.useMemo(
    () => formatQuotaResetCountdown(quotaResetAt),
    [quotaResetAt]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop
          data-testid="quota-dialog-backdrop"
          onClick={() => handleOpenChange(false)}
        />
        <DialogPopup className="max-w-md w-full border-border/80 bg-card p-5 sm:p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Message Quota Exceeded
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Hourly request threshold reached
                </DialogDescription>
              </div>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close quota notification"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                />
              }
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-sm text-foreground">
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{countdownText}</p>
                  <p className="text-xs text-muted-foreground">
                    Hepozy protects workspace performance by limiting rapid requests. Your message quota will automatically unlock once the cooldown window expires.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => handleOpenChange(false)}
              className="w-full sm:w-auto cursor-pointer"
            >
              Understood
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
