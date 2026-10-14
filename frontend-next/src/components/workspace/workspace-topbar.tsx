'use client';

import * as React from 'react';
import { Menu as MenuIcon, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserProfileDropdown } from '@/components/workspace/user-profile-dropdown';

interface WorkspaceTopbarProps {
  currentTitle?: string | null;
  onToggleMobileDrawer: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceTopbar({
  currentTitle,
  onToggleMobileDrawer,
  onOpenSettings,
}: WorkspaceTopbarProps) {
  const displayTitle = currentTitle || 'New conversation';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Mobile menu hamburger button */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onToggleMobileDrawer}
          aria-label="Toggle navigation menu"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>

        {/* Current conversation title */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            data-testid="topbar-conversation-title"
            className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base"
          >
            {displayTitle}
          </span>
        </div>
      </div>

      {/* Right controls: Settings trigger, Theme toggle, User profile dropdown */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>

        <ThemeToggle />

        <div className="ml-1 border-l border-border/60 pl-2">
          <UserProfileDropdown onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </header>
  );
}
