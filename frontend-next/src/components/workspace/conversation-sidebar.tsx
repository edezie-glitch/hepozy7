'use client';

import * as React from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { UserProfileDropdown } from '@/components/workspace/user-profile-dropdown';
import { useConversations, useDeleteConversation } from '@/hooks/use-conversations';
import { useChatStore } from '@/stores/use-chat-store';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'hepozy_sidebar_collapsed';
const EVENT_NAME = 'hepozy-sidebar-collapse';

function getSidebarCollapsedSnapshot(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (item !== null) {
      return item === 'true';
    }
    const match = document.cookie.match(new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]*)`));
    if (match) {
      return match[1] === 'true';
    }
    return null;
  } catch {
    return null;
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
    document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=31536000; SameSite=Lax`;
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
  const rawCollapsed = React.useSyncExternalStore(
    subscribeToSidebarState,
    getSidebarCollapsedSnapshot,
    () => defaultCollapsed
  );
  const persistedCollapsed = rawCollapsed ?? defaultCollapsed;

  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
    try {
      document.documentElement.setAttribute('data-sidebar-mounted', 'true');
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
      } else if (stored === 'false') {
        document.documentElement.removeAttribute('data-sidebar-collapsed');
      }
      if (stored !== null && !document.cookie.includes(`${STORAGE_KEY}=`)) {
        document.cookie = `${STORAGE_KEY}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const [searchQuery, setSearchQuery] = React.useState('');
  const { data: conversations = [], isLoading } = useConversations();
  const deleteMutation = useDeleteConversation();
  const conversationButtonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const isControlled = isCollapsedProp !== undefined;
  const collapsed = isControlled ? isCollapsedProp : persistedCollapsed;

  const handleToggleCollapse = () => {
    const next = !collapsed;
    if (next) {
      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
    } else {
      document.documentElement.removeAttribute('data-sidebar-collapsed');
    }
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
    useChatStore.getState().stopConversationGeneration(id);
    useChatStore.getState().clearConversationMessages(id);
    deleteMutation.mutate(id);
    if (activeId === id) {
      onSelectConversation(null);
    }
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar select-none overflow-hidden',
        hasMounted && 'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      aria-label="Conversation Sidebar"
    >
      {/* Brand & Action Header */}
      <div
        className={cn(
          'flex flex-col gap-3 p-3 border-b border-border/70',
          collapsed && 'items-center'
        )}
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleToggleCollapse}
                  aria-label="Expand sidebar"
                  aria-expanded={false}
                  data-testid="sidebar-toggle-button"
                  className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-accent hover:border-primary/40 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ring-offset-background"
                >
                  {/* Official Hepozy Logo Image at rest */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/hepozy.jpg"
                    alt="Hepozy logo"
                    className="h-full w-full rounded-lg object-cover transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0"
                  />
                  {/* Expand icon on hover/focus */}
                  <PanelLeft
                    className="absolute h-4 w-4 text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                    data-testid="sidebar-expand-icon"
                  />
                </button>
              }
            />
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <div
            className="flex items-center justify-between px-1 py-0.5 w-full"
            data-sidebar-expanded-only="true"
          >
            <div className="flex items-center gap-2.5 overflow-hidden" title="Hepozy">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-border/50 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hepozy.jpg"
                  alt="Hepozy logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="font-bold tracking-tight text-foreground text-sm truncate">
                Hepozy
              </span>
            </div>

            {/* Drawer Collapse Button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleCollapse}
                    aria-label="Collapse sidebar"
                    aria-expanded={true}
                    data-testid="sidebar-toggle-button"
                    className="text-muted-foreground hover:text-foreground cursor-pointer h-7 w-7"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">Collapse sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

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
            data-sidebar-expanded-only="true"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
        )}

        {/* Real-time search filter */}
        {!collapsed && (
          <div className="relative w-full" data-sidebar-expanded-only="true">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="h-8 pl-8 text-xs bg-muted/40 border-border/80"
            />
          </div>
        )}
      </div>

      {/* Conversation History List */}
      {!collapsed ? (
        <div
          className="flex-1 overflow-y-auto px-2 py-3 space-y-1"
          data-sidebar-expanded-only="true"
        >
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
            filteredConversations.map((conv, index) => {
              const isActive = activeId === conv.id;
              const displayTitle = conv.title || 'New conversation';

              return (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex w-full items-center justify-between rounded-lg transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground shadow-xs'
                      : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <button
                    ref={(el) => {
                      conversationButtonRefs.current[index] = el;
                    }}
                    type="button"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => onSelectConversation(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Delete') {
                        e.preventDefault();
                        handleDelete(e, conv.id);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextIndex = (index + 1) % filteredConversations.length;
                        conversationButtonRefs.current[nextIndex]?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevIndex =
                          (index - 1 + filteredConversations.length) % filteredConversations.length;
                        conversationButtonRefs.current[prevIndex]?.focus();
                      }
                    }}
                    className={cn(
                      'flex flex-1 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ring-offset-background',
                      isActive ? 'font-medium text-accent-foreground' : 'text-foreground/80 hover:text-foreground'
                    )}
                  >
                    <MessageSquare
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className="truncate">{displayTitle}</span>
                  </button>

                  {/* Delete action button */}
                  <div className="pr-1.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Delete conversation"
                            onClick={(e) => handleDelete(e, conv.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                conversationButtonRefs.current[index]?.focus();
                              }
                            }}
                            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:text-destructive focus-visible:bg-destructive/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ring-offset-background"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <TooltipContent side="right">Delete conversation</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1" aria-hidden="true" />
      )}

      {/* Footer Controls: User Profile */}
      <div
        className={cn(
          'border-t border-border/70 p-2 flex',
          collapsed ? 'items-center justify-center' : 'w-full'
        )}
        data-testid="sidebar-footer"
      >
        {collapsed ? (
          <UserProfileDropdown onOpenSettings={onOpenSettings} showName={false} />
        ) : (
          <div className="w-full" data-sidebar-expanded-only="true">
            <UserProfileDropdown
              onOpenSettings={onOpenSettings}
              showName={true}
              className="w-full"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
