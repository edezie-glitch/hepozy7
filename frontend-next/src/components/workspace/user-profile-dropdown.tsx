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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UserProfileDropdownProps {
  onOpenSettings?: () => void;
  showName?: boolean;
  className?: string;
}

export function UserProfileDropdown({
  onOpenSettings,
  showName = false,
  className,
}: UserProfileDropdownProps) {
  const { username, email, initial, signOut } = useUser();

  const trigger = (
    <DropdownMenuTrigger
      className={cn(
        'flex items-center gap-2.5 rounded-lg text-left text-sm font-medium transition-colors hover:bg-accent/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ring-offset-background cursor-pointer select-none',
        showName ? 'w-full px-2.5 py-2' : 'h-8 w-8 justify-center p-0 rounded-lg',
        className
      )}
      aria-label="User profile menu"
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-sm text-xs',
          showName ? 'h-8 w-8' : 'h-7 w-7'
        )}
      >
        {initial}
      </div>
      {showName && (
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden text-left leading-tight">
          <span className="truncate font-medium text-foreground" title={username}>
            {username}
          </span>
          {email && (
            <span className="truncate text-xs text-muted-foreground" title={email}>
              {email}
            </span>
          )}
        </div>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {!showName ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent side="right">User profile</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <DropdownMenuPortal>
        <DropdownMenuPositioner
          side={showName ? 'top' : 'right'}
          align={showName ? 'start' : 'end'}
          sideOffset={8}
        >
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
