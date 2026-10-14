'use client';

import * as React from 'react';
import { Plus, Search, MessageSquare, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserProfileDropdown } from '@/components/workspace/user-profile-dropdown';
import { useConversations, useDeleteConversation } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';

interface ConversationSidebarProps {
  activeId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewChat: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function ConversationSidebar({
  activeId,
  onSelectConversation,
  onNewChat,
  onOpenSettings,
  className,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const { data: conversations = [], isLoading } = useConversations();
  const deleteMutation = useDeleteConversation();

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
        'flex h-full w-64 flex-col border-r border-border bg-sidebar transition-colors select-none',
        className
      )}
    >
      {/* Brand & Action Header */}
      <div className="flex flex-col gap-3 p-3 border-b border-border/70">
        <div className="flex items-center gap-2.5 px-1 py-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-xs shadow-sm">
            H
          </div>
          <span className="font-bold tracking-tight text-foreground text-sm">
            Hepozy
          </span>
          <span className="ml-auto flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        </div>

        {/* New Chat Button */}
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 shadow-sm cursor-pointer"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>

        {/* Real-time search filter */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Conversation History List */}
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

      {/* User Profile Footer */}
      <div className="border-t border-border/70 p-2">
        <UserProfileDropdown onOpenSettings={onOpenSettings} showName={true} />
      </div>
    </aside>
  );
}
