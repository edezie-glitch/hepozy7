'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/hooks/use-user';
import { Settings, LogOut } from 'lucide-react';

interface UserProfileDropdownProps {
  onOpenSettings?: () => void;
  showName?: boolean;
}

export function UserProfileDropdown({
  onOpenSettings,
  showName = false,
}: UserProfileDropdownProps) {
  const { username, email, initial, signOut } = useUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-lg p-1.5 text-left text-sm font-medium transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
        aria-label="User profile menu"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-sm text-xs">
          {initial}
        </div>
        {showName && (
          <div className="flex flex-col overflow-hidden text-left leading-tight">
            <span className="truncate font-medium text-foreground">{username}</span>
            {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          </div>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuPositioner side="top" align="start" sideOffset={8}>
          <DropdownMenuContent className="w-56 p-1.5 shadow-lg">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{username}</p>
              {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onOpenSettings}
              className="flex items-center gap-2.5 text-sm"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="flex items-center gap-2.5 text-sm text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
