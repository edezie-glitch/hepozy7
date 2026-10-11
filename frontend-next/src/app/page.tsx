import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, FileText, Search } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm font-bold">
            H
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Hepozy
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Workspace Assistant</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
            Intelligence that works with your documents
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Multi-model LLM routing, real-time file generation, semantic search, and document understanding in a unified workspace.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button size="lg" className="h-12 px-6 text-base shadow-md cursor-pointer">
              <MessageSquare className="mr-2 h-5 w-5" />
              Start Conversation
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6 text-base cursor-pointer">
              Explore Features
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-12 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-card-foreground">Multi-Model Routing</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Dynamically routes inquiries to the optimal Groq or Gemini model.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-card-foreground">Document Generation</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Produce Word, PDF, Excel, and CSV documents from structured data.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Search className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-card-foreground">Semantic Search</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vector retrieval with pgvector across your attachments and history.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
