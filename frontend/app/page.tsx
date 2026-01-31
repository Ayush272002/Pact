"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BrainCircuit, Users2, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  const router = useRouter();
  const [scenario, setScenario] = useState("");

  const handleSimulate = () => {
    if (scenario.trim()) {
      router.push(`/simulate?scenario=${encodeURIComponent(scenario)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSimulate();
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <span className="text-sm font-bold tracking-tighter uppercase italic">
            Pact
          </span>
          <div className="hidden md:flex gap-6 text-xs font-medium text-zinc-500 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">
              Simulator
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Research Paper
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Nodes
            </a>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-xs uppercase tracking-widest hover:bg-white/5"
        >
          Enter Console
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="relative flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden">
        {/* Background Glow - The "Swarm" Heart */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Main Content */}
        <div className="relative z-10 text-center space-y-8 max-w-4xl px-4">
          <Badge
            variant="outline"
            className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5 px-4 py-1 rounded-full animate-pulse"
          >
            Adversarial Equilibrium Engine v1.0
          </Badge>

          <h1 className="text-6xl md:text-8xl font-light tracking-tight text-white leading-tight">
            Force consensus <br />
            <span className="text-zinc-500 italic">through conflict.</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
            A swarm of adversarial AI agents brute-forcing Nash Equilibrium.
            Define the scenario, watch the agents negotiate, and witness the
            emergent treaty.
          </p>

          {/* Prompt / Input Bar */}
          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative flex items-center bg-zinc-900/80 border border-white/10 rounded-xl p-2 backdrop-blur-xl">
              <Search className="ml-3 h-5 w-5 text-zinc-500" />
              <Input
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a geopolitical conflict or enterprise deadlock..."
                className="border-0 bg-transparent focus-visible:ring-0 text-white placeholder:text-zinc-600 text-base"
              />
              <Button
                onClick={handleSimulate}
                className="bg-white text-black hover:bg-zinc-200 px-6 font-semibold"
              >
                Simulate
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 mt-32 w-full max-w-6xl border border-white/5">
          <div className="p-10 bg-[#030303] hover:bg-zinc-900/50 transition-colors group">
            <BrainCircuit
              className="mb-4 text-zinc-500 group-hover:text-indigo-400 transition-colors"
              size={24}
            />
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-2">
              Swarm Logic
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Parallel negotiation rounds where agents propose, critique, and
              trade via Monte Carlo simulations.
            </p>
          </div>
          <div className="p-10 bg-[#030303] hover:bg-zinc-900/50 transition-colors group border-x border-white/5">
            <Activity
              className="mb-4 text-zinc-500 group-hover:text-indigo-400 transition-colors"
              size={24}
            />
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-2">
              P(Stability)
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Real-time prediction of deal longevity and identification of
              potential breakdown points.
            </p>
          </div>
          <div className="p-10 bg-[#030303] hover:bg-zinc-900/50 transition-colors group">
            <Users2
              className="mb-4 text-zinc-500 group-hover:text-indigo-400 transition-colors"
              size={24}
            />
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-2">
              Consensus Map
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Visualise the transition from polarized conflict to optimized
              agreement through force-directed graphs.
            </p>
          </div>
        </div>
      </main>

      {/* Stats Footer */}
      <footer className="p-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
        <div className="flex gap-8 mb-4 md:mb-0">
          <span>Active Agents: 14,021</span>
          <span>Avg Epochs to Consensus: 12.4</span>
        </div>
        <div className="flex gap-4">
          <span>System Status: Optimal</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </div>
      </footer>
    </div>
  );
}
