-- ==============================================================================
-- Hepozy Database Schema (Supabase / PostgreSQL)
-- Run this in the Supabase Dashboard -> SQL Editor -> New query
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgmq" CASCADE;

-- ------------------------------------------------------------------------------
-- 2. Profiles (User Accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Conversations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- ------------------------------------------------------------------------------
-- 4. Chat Messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    download_url TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_quota ON public.chat_messages(user_id, created_at);

-- ------------------------------------------------------------------------------
-- 5. Response Cache (Exact / Semantic Cached Answers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.response_cache (
    cache_key TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    model TEXT NOT NULL,
    reply TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    safeguard_passed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. LLM Token & Cost Usage Tracking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON public.llm_usage(user_id, created_at);

-- ------------------------------------------------------------------------------
-- 7. User Uploads (Metadata for files stored in Supabase Storage)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_uploads_user ON public.user_uploads(user_id, conversation_id);

-- ------------------------------------------------------------------------------
-- 8. Crawler Documents & Deduplication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_document_hash UNIQUE (source_url, content_hash)
);

-- ------------------------------------------------------------------------------
-- 9. Document Chunks & Vector Store (768 Dimensions for Gemini Embeddings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
    document_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ------------------------------------------------------------------------------
-- 10. RPC: Vector Similarity Search (match_documents)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(768),
    match_count INTEGER DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id TEXT,
    document_id TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.document_id AS id,
        dc.document_id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND (filter = '{}'::jsonb OR dc.metadata @> filter)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Crawler Queue Setup & Public RPC Wrappers (pgmq)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    PERFORM pgmq.create('crawl_tasks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM pgmq.create('embed_tasks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- PostgREST RPC wrappers for queue access
CREATE OR REPLACE FUNCTION public.pgmq_send(queue_name TEXT, msg JSONB)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT pgmq.send(queue_name, msg);
$$;

CREATE OR REPLACE FUNCTION public.pgmq_read(queue_name TEXT, vt INTEGER, qty INTEGER)
RETURNS SETOF pgmq.message_record
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM pgmq.read(queue_name, vt, qty);
$$;

CREATE OR REPLACE FUNCTION public.pgmq_archive(queue_name TEXT, msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT pgmq.archive(queue_name, msg_id);
$$;

-- ------------------------------------------------------------------------------
-- 12. Storage Bucket Creation (user-uploads)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;
