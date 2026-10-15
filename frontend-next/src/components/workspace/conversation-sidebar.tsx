'use client';

import * as React from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { UserProfileDropdown } from '@/components/workspace/user-profile-dropdown';
import { useConversations, useDeleteConversation } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'hepozy_sidebar_collapsed';
const EVENT_NAME = 'hepozy-sidebar-collapse';

function getSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function subscribeToSidebarState(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

function setStoredSidebarCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore storage access errors
  }
}

interface ConversationSidebarProps {
  activeId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewChat: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  defaultCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  className?: string;
}

export function ConversationSidebar({
  activeId,
  onSelectConversation,
  onNewChat,
  onOpenSettings,
  isCollapsed: isCollapsedProp,
  defaultCollapsed = false,
  onToggleCollapse,
  className,
}: ConversationSidebarProps) {
  const persistedCollapsed = React.useSyncExternalStore(
    subscribeToSidebarState,
    getSidebarCollapsedSnapshot,
    () => defaultCollapsed
  );

  const [searchQuery, setSearchQuery] = React.useState('');
  const { data: conversations = [], isLoading } = useConversations();
  const deleteMutation = useDeleteConversation();

  const isControlled = isCollapsedProp !== undefined;
  const collapsed = isControlled ? isCollapsedProp : persistedCollapsed;

  const handleToggleCollapse = () => {
    const next = !collapsed;
    if (!isControlled) {
      setStoredSidebarCollapsed(next);
    }
    onToggleCollapse?.(next);
  };

  const filteredConversations = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) => {
      const title = (c.title || 'New conversation').toLowerCase();
      return title.includes(query);
    });
  }, [conversations, searchQuery]);

  const handleDelete = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
    if (activeId === id) {
      onSelectConversation(null);
    }
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out select-none overflow-hidden',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      aria-label="Conversation Sidebar"
    >
      {/* Brand & Action Header */}
      <div className={cn('flex flex-col gap-3 p-3 border-b border-border/70', collapsed && 'items-center')}>
        <div className={cn('flex items-center justify-between px-1 py-0.5 w-full', collapsed && 'flex-col gap-3')}>
          <div className="flex items-center gap-2.5 overflow-hidden" title="Hepozy">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-xs shadow-sm">
              H
            </div>
            {!collapsed && (
              <span className="font-bold tracking-tight text-foreground text-sm truncate">
                Hepozy
              </span>
            )}
          </div>

          {/* Drawer Toggle Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleCollapse}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-expanded={!collapsed}
                  data-testid="sidebar-toggle-button"
                  className={cn(
                    'text-muted-foreground hover:text-foreground cursor-pointer',
                    collapsed ? 'h-8 w-8' : 'h-7 w-7'
                  )}
                >
                  {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              }
            />
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* New Chat Button */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={onNewChat}
                  variant="default"
                  size="icon"
                  className="h-8 w-8 shadow-sm cursor-pointer"
                  aria-label="New Chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 shadow-sm cursor-pointer"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
        )}

        {/* Real-time search filter */}
        {!collapsed && (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="h-8 pl-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
            />
          </div>
        )}
      </div>

      {/* Conversation History List */}
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent
          </div>

          {isLoading ? (
            <div data-testid="conversation-skeletons" className="space-y-2 p-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 rounded-lg p-2.5 bg-muted/30 animate-pulse border border-border/30"
                >
                  <div className="h-3.5 w-3/4 rounded bg-muted/70" />
                  <div className="h-2.5 w-1/3 rounded bg-muted/50" />
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeId === conv.id;
              const displayTitle = conv.title || 'New conversation';

              return (
                <button
                  key={conv.id}
                  type="button"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    'group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground shadow-xs'
                      : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className="truncate">{displayTitle}</span>
                  </div>

                  {/* Delete button */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete conversation"
                    onClick={(e) => handleDelete(e, conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDelete(e, conv.id);
                      }
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1" aria-hidden="true" />
      )}

      {/* Footer Controls: Settings button in collapsed rail & User Profile */}
      <div className={cn('border-t border-border/70 p-2 flex flex-col gap-2', collapsed && 'items-center')}>
        {collapsed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Open settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        )}

        <UserProfileDropdown onOpenSettings={onOpenSettings} showName={!collapsed} />
      </div>
    </aside>
  );
}
