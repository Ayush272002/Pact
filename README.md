# Pact: The Nash Engine

**Pact** is a game-theoretic negotiation framework that moves beyond "polite" AI. By combining Large Language Models with formal International Relations theory, Pact simulates high-stakes environments where agents must maximise utility functions, manage "Audience Costs," and navigate the "Shadow of the Future."

Unlike standard chatbots, Pact agents have the **mathematical freedom to defect**, leading to emergent, realistic strategic behaviors.



---

## Core Architecture

* **The Orchestration:** Powered by **FastAPI** and **LangGraph**, utilising a "World State" where agents participate in a **Recency-Penalised Urgency Auction** to earn the right to speak.
* **The Strategy Layer:** Implements six classic repeated Prisoner's Dilemma strategies:
    * **Tit-for-Tat:** Reciprocal cooperation or retaliation.
    * **Grim Trigger:** Permanent defection following the first betrayal.
    * **Zero-Determinant (ZD):** Coercive strategies that unilaterally dictate the terms of cooperation.
* **The Utility Function:** Agents calculate success based on:
    $$U_i = (1 - \text{Tension}) \times (0.5 + 0.5 \times \delta)$$
    *Where $\delta$ represents the **Shadow of the Future** (discount factor).*

---

## Tech Stack

**Frontend:** [`Next.js 16 (Turbopack)`](https://nextjs.org/docs) · [`Tailwind CSS 4`](https://tailwindcss.com/docs) · [`shadcn/ui`](https://ui.shadcn.com/docs/components) · [`Motion`](https://motion.dev/docs/react)

**Backend:** [`FastAPI`](https://fastapi.tiangolo.com/) · [`LangGraph`](https://www.langchain.com/langgraph) · `Python 3.13+`

**Package Managers:** [`pnpm`](https://pnpm.io/) · [`uv`](https://docs.astral.sh/uv/)

---

## Quick Start

### Prerequisites
* [pnpm](https://pnpm.io/installation)
* [uv](https://docs.astral.sh/uv/getting-started/installation/)

### Installation & Development
```bash
# Install all dependencies
cd frontend
pnpm install

cd ../backend
uv sync
```

```bash
# Launch the Nash Engine (Backend)
cd backend
uv run fastapi dev main.py
```

```bash
# Launch the Strategic Dashboard (Frontend)
cd frontend
pnpm dev
```

---

## Key Technical Features

### Equilibrium Detection
The simulation avoids "infinite loops" by monitoring a **Consensus Threshold**. If no agent’s `Adjusted_Urgency` exceeds **2.0**, the Nash Engine declares a stable equilibrium and terminates the simulation.

### State Consistency & BATNA
To prevent "Diplomatic Drift," all treaties are managed via a rigorous JSON-based **Proposal System**. If the math behind a concession fails to align with an agent's **BATNA** (Best Alternative to Negotiated Agreement), the engine rejects the interaction at the protocol level before it reaches the chat interface.

## Project Structure
```text
frontend/             -> Next.js frontend (Strategic Dashboard)
├── app/              -> Next.js App Router
│   ├── simulate/     -> Simulation interface page
│   ├── vis/          -> Game tree visualisation page
│   └── page.tsx      -> Home page
├── components/ui/    -> shadcn/ui visualisation components
├── lib/              -> Utility functions
└── types/            -> TypeScript type definitions

backend/              -> FastAPI (The Nash Engine & LangGraph state machine)
├── core/             -> Core constants and configuration
├── routers/          -> API endpoints (simulation_router.py)
├── services/         -> Business logic (LLM & simulation services)
├── engine.py         -> Nash Engine core
├── schemas.py        -> Pydantic data models
└── main.py           -> FastAPI application entry point
```

## License
[MIT License](LICENSE)