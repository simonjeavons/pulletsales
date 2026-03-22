# Lloyds Pullet Sales Order System

Phase 1: Admin setup and master data management for Lloyds' pullet sales ordering process.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TanStack Start, React, TypeScript, TailwindCSS |
| Forms | TanStack Form, Zod validation |
| Data fetching | TanStack Query |
| Backend | TanStack server functions |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Email | Resend (pluggable provider) |
| PDF | React PDF (scaffolded) |
| Signatures | react-signature-canvas (scaffolded) |
| Hosting | Cloudflare Pages |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (already provisioned)
- A Resend API key for email

### 1. Clone and install

```bash
git clone https://github.com/simonjeavons/pulletsales.git
cd pulletsales
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase and Resend credentials:

```
VITE_SUPABASE_URL=https://hcgutuiutrbaxbndwqev.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_key
EMAIL_FROM=noreply@yourdomain.com
VITE_APP_URL=http://localhost:3000
```

### 3. Database

The database schema has been applied via Supabase migrations. Tables:

- `profiles` — user metadata linked to Supabase Auth
- `reps` — sales representatives
- `customers` — customer accounts
- `customer_delivery_addresses` — per-customer delivery locations
- `extras` — optional services for breeds
- `breeds` — poultry breed master data
- `breed_extras` — breed-to-extra junction table
- `transporters` — transport providers

Row Level Security is enabled on all tables.

### 4. Seed data (optional)

Run the seed SQL in the Supabase SQL editor:

```
supabase/seed/seed.sql
```

### 5. Create your first admin user

1. Go to Supabase Dashboard > Authentication > Users
2. Create a new user with email/password
3. Insert a profile record:

```sql
INSERT INTO public.profiles (auth_user_id, full_name, email, role, is_active)
VALUES ('YOUR_AUTH_USER_ID', 'Admin Name', 'admin@example.com', 'admin', true);
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy .output/public
```

Set environment variables in the Cloudflare dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `VITE_APP_URL`

## Project Structure

```
src/
├── components/
│   ├── ui/            # Button, Badge, Modal, DataTable, SearchBar, PageHeader
│   ├── layout/        # Sidebar, TopBar
│   ├── forms/         # FormField, reusable form components
│   ├── signatures/    # SignaturePad (Phase 2 ready)
│   └── pdf/           # PDF components (Phase 2 ready)
├── features/          # Feature-specific logic (future use)
├── lib/
│   ├── supabase/      # Browser + server Supabase clients
│   ├── email/         # Pluggable email provider (Resend)
│   ├── validation/    # Zod schemas
│   ├── pdf/           # React PDF templates
│   └── storage/       # Supabase Storage helpers (future)
├── routes/
│   ├── __root.tsx
│   ├── login.tsx
│   ├── forgot-password.tsx
│   ├── auth/
│   │   ├── reset-password.tsx
│   │   └── set-password.tsx
│   └── _authenticated/
│       ├── dashboard.tsx
│       └── admin/
│           ├── users.tsx
│           ├── reps.tsx
│           ├── customers.tsx
│           ├── extras.tsx
│           ├── breeds.tsx
│           └── transporters.tsx
├── server/
│   ├── functions/     # TanStack server functions (API layer)
│   └── services/      # Business logic services
├── types/             # TypeScript types
└── styles/            # TailwindCSS
```

## Architecture Decisions

- **Soft delete everywhere** — `is_active` / `is_available` flags instead of hard delete
- **Server-side validation** — Zod schemas validated in server functions
- **Role-based access** — admin routes protected at both router and server function level
- **Email abstraction** — swap `ResendProvider` for any provider implementing `EmailProvider`
- **Audit timestamps** — `created_at` / `updated_at` on all tables with auto-update triggers
- **Phase 2 ready** — schema, storage buckets, PDF and signature infrastructure scaffolded

## Phase 2 Roadmap

The architecture supports adding:
- Order entry with breed quantities
- Extras on orders
- Delivery scheduling
- Transporter assignment
- PDF order confirmations (React PDF infrastructure ready)
- Digital signature capture (react-signature-canvas ready)
- Supabase Storage for documents
- Reporting and exports
