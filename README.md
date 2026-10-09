# Hepozy MVP

Hepozy is an AI workspace assistant built with **FastAPI**, **Supabase**, and multi-model LLM routing (**Groq** & **Google Gemini**). It supports conversational chat, document and image understanding, real-time file generation (`.docx`, `.pdf`, `.xlsx`, `.csv`), semantic search / RAG with arXiv fallback, and background web crawling.

---

## ✨ Features

- **Interactive Chat Workspace**: Single-page web interface with real-time messaging, stop generation, conversation search, and dark mode.
- **Dynamic File Generation**: Generates downloadable Word (`.docx`), PDF (`.pdf`), Excel (`.xlsx`), and CSV (`.csv`) files from AI outputs with embedded user images and structured tables.
- **Multimodal Attachment Support**: Extracts and reads text from uploaded documents (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`) and inspects images via vision models.
- **Intelligent Model Routing**: Routes tasks based on complexity and format requirements (Groq `openai/gpt-oss-20b`/`120b` and Gemini `gemini-flash-latest`) with automatic provider failover.
- **RAG & arXiv Research Fallback**: Vector similarity retrieval powered by Supabase `pgvector` and Gemini embeddings (768-dim), with automatic live arXiv paper search and ingestion for academic queries.
- **Background Crawler Pipeline**: Message-queue worker using Supabase `pgmq` (`crawl_tasks` and `embed_tasks`) for scheduled web scraping and document chunking.
- **Safety & Rate Limiting**: Llama Prompt Guard injection detection, output safeguard checks, and user quota management (50 messages / 20k tokens per 5 hours).

---

## 🏗️ Architecture & Project Structure

```
hepozy7/
├── frontend/                     # Web client UI
│   ├── home.html                 # Main chat workspace & history sidebar
│   ├── home.js                   # Client logic & API communication
│   ├── login.html                # Authentication screens (Login)
│   ├── register.html             # Registration screen
│   └── verifypend.html           # Email verification notice
├── orchestrator/                 # FastAPI backend application
│   ├── main.py                   # Server entry point, endpoints, and chat pipeline
│   ├── auth.py                   # Supabase authentication & rate limiter
│   ├── attachments.py            # Document text extraction & image understanding
│   ├── file_generator.py         # Word, PDF, Excel, and CSV generator
│   ├── cache.py                  # Semantic & exact response cache
│   ├── site_info.py              # Assistant system prompt and persona
│   ├── workflow.py               # Workflow planner and task classifier
│   ├── requirements.txt          # Python dependencies
│   ├── crawler/                  # Background web crawler (PGMQ worker)
│   ├── intent_router/            # NLP classification & reasoning rules
│   ├── model_router/             # Multi-model routing, adapters & fallbacks
│   └── retriever/                # Vector store, embedder, and search
├── static/                       # Icons, manifest, and static assets
├── .env.example                  # Environment configuration template
├── schema.sql                    # Supabase database schema and migrations
└── README.md                     # Project documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+**
- A **[Supabase](https://supabase.com)** project
- API keys from **[Groq Console](https://console.groq.com)** and **[Google AI Studio](https://aistudio.google.com)**

---

### 2. Database Setup

1. Go to your **Supabase Dashboard** $\rightarrow$ **SQL Editor**.
2. Open a new query, paste the contents of [`schema.sql`](schema.sql), and click **Run**.
3. Under **Authentication** $\rightarrow$ **Providers** $\rightarrow$ **Email**, ensure **Enable Email provider** is turned **ON**.
4. Add `http://localhost:8000/login.html` to your **Redirect URLs** in Supabase Auth settings.

---

### 3. Environment Configuration

Copy the example configuration to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and supply your actual credentials:

```env
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# LLM Providers
GROQ_API_KEY=gsk_your_groq_key
GEMINI_API_KEY=your_gemini_key

# Optional Settings
OWNER_ADMIN_KEY=your-admin-secret
ENABLE_DOCS=1
ALLOWED_ORIGINS=*
LOCAL_DEV=1
```

---

### 4. Installation

Create and activate a virtual environment, then install dependencies:

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r orchestrator/requirements.txt
```

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r orchestrator/requirements.txt
```

---

### 5. Running the Application

Start the Uvicorn web server from the project root:

```bash
python -m uvicorn orchestrator.main:app --reload --port 8000
```

- **Web App**: [http://localhost:8000](http://localhost:8000) *(redirects to login)*
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs) *(when `ENABLE_DOCS=1`)*

---

### 6. (Optional) Run the Crawler Worker

If you are using background web crawling:

```bash
python orchestrator/crawler/scheduler.py
```

---

## 📄 License

MIT
