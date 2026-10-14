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
import { ThemeToggle } from '@/components/theme-toggle';
import { useUser } from '@/hooks/use-user';
import { X, LogOut, User, SunMoon } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { username, email, signOut } = useUser();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-md w-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription className="sr-only">
                Manage your Hepozy workspace account settings and preferences.
              </DialogDescription>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close settings" className="h-8 w-8" />}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          <div className="space-y-6 pt-2">
            {/* Account section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </h4>
              <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username
                  </span>
                  <span className="font-medium text-foreground">{username}</span>
                </div>
                {email && (
                  <div className="flex items-center justify-between border-t border-border/50 pt-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground text-xs">{email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Appearance section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Appearance
              </h4>
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <SunMoon className="h-4 w-4 text-muted-foreground" />
                  Color Theme
                </span>
                <ThemeToggle />
              </div>
            </div>

            {/* Danger zone */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                Danger Zone
              </h4>
              <Button
                variant="destructive"
                className="w-full flex items-center justify-center gap-2"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
