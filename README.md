# Modern Next.js + FastAPI Template

A clean, modern, full-stack template with Next.js 16, FastAPI, Tailwind CSS 4, and shadcn/ui.

<img src="public/image.png" alt="Modern Next.js + FastAPI Template" width="auto">

## Tech Stack

**Frontend:** [`Next.js 16 (Turbopack)`](https://nextjs.org/docs) · [`Tailwind CSS 4`](https://tailwindcss.com/docs) · [`shadcn/ui`](https://ui.shadcn.com/docs/components) · [`Lucide React`](https://lucide.dev/icons/) · [`Sonner`](https://sonner.emilkowal.ski/) · [`Motion`](https://motion.dev/docs/react)

**Backend:** [`FastAPI`](https://fastapi.tiangolo.com/) · `Python 3.13+`

**Linting:** [`Ruff`](https://docs.astral.sh/ruff/) (Python) · [`ESLint`](https://eslint.org/docs/latest/) (TypeScript)

**Package Managers:** [`pnpm`](https://pnpm.io/) (TypeScript) · [`uv`](https://docs.astral.sh/uv/) (Python)

## Prerequisites

- [pnpm](https://pnpm.io/installation) — fast Node.js package manager
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — fast Python package manager

## Quick Start

```bash
# Install dependencies
pnpm install && uv sync

# Run frontend (localhost:3000)
pnpm dev

# Run backend (localhost:8000)
uv run fastapi dev backend/main.py
```

## Project Structure

```
app/            -> Next.js frontend
backend/        -> FastAPI backend
components/ui/  -> shadcn/ui components
```

## Commands

```bash
# Add shadcn component (from root directory)
pnpm dlx shadcn@latest add button

# Linting and formatting
uv run ruff check --fix backend/
uv run ruff format backend/
pnpm run lint --fix
```

## Licence

[MIT License](LICENSE)
