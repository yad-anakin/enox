# Enox AI Platform

A premium, production-ready AI platform with multi-model support, custom agents, and a separate admin dashboard.

## Architecture

```
/app          → User-facing Next.js frontend (port 3000)
/backend      → Express.js API server (port 3001)
/admin-app    → Separate admin Next.js dashboard (port 3002)
/supabase     → Database schema & RLS policies
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Radix UI, Lucide Icons, Zustand
- **Backend**: Express.js, OpenAI SDK (multi-provider), Zod validation
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Auth**: Supabase Auth with Google OAuth

## Prerequisites

- Node.js 18+
- A Supabase project
- Google OAuth credentials (configured in Supabase)

## Setup

### 1. Database

1. Create a new Supabase project
2. Run `supabase/schema.sql` in the Supabase SQL Editor
3. Enable Google OAuth in Supabase Auth settings

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase URL, service role key, and JWT secret
npm install
npm run dev
```

### 3. User App

```bash
cd app
cp .env.example .env.local
# Fill in your Supabase URL and anon key
npm install
npm run dev
```

### 4. Admin App

```bash
cd admin-app
cp .env.example .env.local
# Fill in your Supabase URL and anon key
npm install
npm run dev
```

## Environment Variables

### Backend (`/backend/.env`)
| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret |
| `FRONTEND_URL` | User app URL (default: http://localhost:3000) |
| `ADMIN_URL` | Admin app URL (default: http://localhost:3002) |

### Frontend Apps (`/app/.env.local` and `/admin-app/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: http://localhost:3001) |

## Features

- **Chat**: Streaming AI responses, model selection, chat history, copy/regenerate
- **Models**: Multi-provider support (OpenAI, Anthropic, Google, Mistral, Groq, OpenRouter)
- **Agents**: Create custom agents with system prompts, share publicly
- **Rate Limiting**: Per-user, per-model daily limits enforced server-side
- **Admin**: Manage models, API keys, users, view usage analytics
- **Security**: API keys never in frontend, RLS policies, server-side validation

## Making a User Admin

After first login, update the user's role in Supabase:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
```

Then access the admin dashboard at `http://localhost:3002`.
