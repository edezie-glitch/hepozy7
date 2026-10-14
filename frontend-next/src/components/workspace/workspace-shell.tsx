'use client';

import * as React from 'react';
import { WorkspaceTopbar } from '@/components/workspace/workspace-topbar';
import { ConversationSidebar } from '@/components/workspace/conversation-sidebar';
import { SettingsModal } from '@/components/workspace/settings-modal';
import { useConversations } from '@/hooks/use-conversations';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageSquare, FileText, Search, X } from 'lucide-react';

export function WorkspaceShell() {
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const { data: conversations = [] } = useConversations();

  const currentConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const currentTitle = currentConversation?.title || (activeConversationId ? 'New conversation' : null);

  const handleSelectConversation = (id: string | null) => {
    setActiveConversationId(id);
    setMobileOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors">
      {/* Desktop Sidebar (hidden on mobile <= 640px) */}
      <div className="hidden sm:flex sm:shrink-0">
        <ConversationSidebar
          activeId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Mobile Drawer (<= 640px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop overlay */}
          <div
            data-testid="mobile-drawer-backdrop"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div
            data-testid="mobile-drawer-panel"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-2xl transition-transform duration-200"
          >
            <div className="flex items-center justify-between border-b border-border/70 p-2 sm:hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Navigation
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationSidebar
                activeId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                onOpenSettings={() => {
                  setMobileOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full border-r-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <WorkspaceTopbar
          currentTitle={currentTitle}
          onToggleMobileDrawer={() => setMobileOpen((prev) => !prev)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
          {!activeConversationId ? (
            /* New Chat / Welcome State */
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-20">
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Workspace Assistant</span>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                    Hepozy
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                  Intelligence that works with your documents
                </h1>

                <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
                  Multi-model LLM routing, real-time file generation, semantic search, and document understanding in a unified workspace.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
                  <Button
                    size="lg"
                    className="h-11 px-6 text-sm sm:text-base shadow-md cursor-pointer"
                    onClick={handleNewChat}
                  >
                    <MessageSquare className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Start Conversation
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-10 text-left sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-card-foreground">Multi-Model Routing</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dynamically routes inquiries to the optimal Groq or Gemini model.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                      <FileText className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-card-foreground">Document Generation</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Produce Word, PDF, Excel, and CSV documents from structured data.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                      <Search className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-sm text-card-foreground">Semantic Search</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vector retrieval with pgvector across your attachments and history.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversation View */
            <div className="flex flex-1 flex-col justify-between p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-sm font-semibold text-foreground">
                    {currentTitle}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <p>Conversation active. Messages will appear here.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
