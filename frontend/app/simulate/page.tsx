"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Globe2, Zap, X, Trash2 } from "lucide-react";

interface Goal {
  text: string;
  priority: number;
}

interface Constraint {
  text: string;
  priority: number;
}

interface Party {
  id: string;
  name: string;
  description: string;
  goals: Goal[];
  constraints: Constraint[];
}

export default function SimulatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [scenario, setScenario] = useState("");
  const [parties, setParties] = useState<Party[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      goals: [{ text: "", priority: 5 }],
      constraints: [{ text: "", priority: 5 }],
    },
  ]);

  useEffect(() => {
    setMounted(true);
    const scenarioParam = searchParams.get("scenario");
    if (scenarioParam) setScenario(scenarioParam);
  }, [searchParams]);

  // --- Logic Handlers ---
  const addParty = () => {
    setParties([...parties, { id: crypto.randomUUID(), name: "", description: "", goals: [{ text: "", priority: 5 }], constraints: [{ text: "", priority: 5 }] }]);
  };
  const updateParty = (id: string, field: keyof Party, value: any) => {
    setParties(parties.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };
  const removeParty = (id: string) => {
    if (parties.length > 1) setParties(parties.filter((p) => p.id !== id));
  };
  
  const addGoal = (partyId: string) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, goals: [...p.goals, { text: "", priority: 5 }] } : p));
  };
  const updateGoal = (partyId: string, index: number, text: string) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, goals: p.goals.map((g, i) => i === index ? { ...g, text } : g) } : p));
  };
  const updateGoalPriority = (partyId: string, index: number, priority: number) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, goals: p.goals.map((g, i) => i === index ? { ...g, priority } : g) } : p));
  };
  const removeGoal = (partyId: string, index: number) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, goals: p.goals.filter((_, i) => i !== index) } : p));
  };

  const addConstraint = (partyId: string) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, constraints: [...p.constraints, { text: "", priority: 5 }] } : p));
  };
  const updateConstraint = (partyId: string, index: number, text: string) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, constraints: p.constraints.map((c, i) => i === index ? { ...c, text } : c) } : p));
  };
  const updateConstraintPriority = (partyId: string, index: number, priority: number) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, constraints: p.constraints.map((c, i) => i === index ? { ...c, priority } : c) } : p));
  };
  const removeConstraint = (partyId: string, index: number) => {
    setParties(parties.map((p) => p.id === partyId ? { ...p, constraints: p.constraints.filter((_, i) => i !== index) } : p));
  };

  const getSliderStyle = (val: number) => ({
    background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(val - 1) * 11.11}%, #18181b ${(val - 1) * 11.11}%, #18181b 100%)`,
  });

  if (!mounted) return <div className="min-h-screen bg-[#030303]" />;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200 antialiased font-sans">
      <style jsx global>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid #030303;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid #030303;
          cursor: pointer;
        }
      `}</style>

      <nav className="flex items-center justify-between px-10 py-8 border-b border-white/5 backdrop-blur-md sticky top-0 z-50 bg-[#030303]/90">
        <div className="flex items-center gap-12">
          <button onClick={() => router.push("/")} className="text-xl font-bold tracking-tighter uppercase">
            Pact<span className="text-indigo-500">.</span>
          </button>
          <div className="hidden md:flex gap-8 text-[11px] uppercase tracking-[0.2em] font-bold text-zinc-500">
            <span className="text-zinc-200 border-b border-indigo-500 pb-1">Simulator</span>
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Protocol</span>
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Ledger</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-bold">System Online</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="space-y-24">
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-indigo-400 mb-6">
              <Zap size={14} />
              <span className="text-[12px] uppercase tracking-[0.3em] font-black">Step 01 / Configure Context</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white leading-tight">
              Initialize <span className="text-zinc-600 italic">Scenario.</span>
            </h1>
            <div className="pt-10">
              <label className="block text-[13px] uppercase tracking-[0.15em] text-zinc-500 mb-4 font-bold">Environment Parameters</label>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Define the conflict landscape..."
                className="w-full bg-transparent border-b border-white/10 py-4 text-2xl font-light focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-900 resize-none overflow-hidden"
                rows={1}
              />
            </div>
          </section>

          <section className="space-y-12">
            <div className="flex items-end justify-between border-b border-white/5 pb-4">
              <h2 className="text-[13px] uppercase tracking-[0.2em] text-zinc-400 font-bold">Participating Agents</h2>
              <Button onClick={addParty} variant="ghost" className="text-[11px] uppercase tracking-widest hover:bg-white/5 text-indigo-400 h-8 font-bold">
                <Plus className="mr-2 h-3 w-3" /> New Agent
              </Button>
            </div>

            <div className="grid gap-16">
              {parties.map((party, idx) => (
                <div key={party.id} className="group relative bg-[#080808] border border-white/5 p-10 rounded-2xl hover:border-white/10 transition-all duration-500 shadow-xl">
                  <div className="absolute -top-3 left-10 bg-[#030303] px-4 py-1 border border-white/10 rounded-full">
                    <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-zinc-500">Agent 0{idx + 1}</span>
                  </div>

                  <div className="space-y-10">
                    <div className="flex justify-between items-start">
                      <input
                        value={party.name}
                        onChange={(e) => updateParty(party.id, "name", e.target.value)}
                        placeholder="AGENT_NAME"
                        className="bg-transparent text-3xl font-light tracking-tight focus:outline-none placeholder:text-zinc-900 w-full"
                      />
                      {parties.length > 1 && (
                        <button onClick={() => removeParty(party.id)} className="text-zinc-500 hover:text-red-500 transition-all p-2">
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] uppercase tracking-widest text-zinc-600 font-bold">Internal Directive</label>
                      <textarea
                        value={party.description}
                        onChange={(e) => updateParty(party.id, "description", e.target.value)}
                        placeholder="Describe motivations..."
                        className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-900 focus:outline-none border-l border-white/10 pl-6 resize-none leading-relaxed"
                        rows={2}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-16">
                      {/* Goals */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-[12px] uppercase tracking-[0.15em] text-zinc-600 font-bold">Goals</span>
                          <button onClick={() => addGoal(party.id)} className="text-zinc-700 hover:text-indigo-400 transition-colors"><Plus size={14}/></button>
                        </div>
                        <div className="space-y-6">
                          {party.goals.map((g, i) => (
                            <div key={i} className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <input 
                                  className="flex-1 bg-transparent text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-900" 
                                  placeholder="Goal..." 
                                  value={g.text} 
                                  onChange={(e) => updateGoal(party.id, i, e.target.value)} 
                                />
                                {party.goals.length > 1 && (
                                  <button 
                                    onClick={() => removeGoal(party.id, i)}
                                    className="text-zinc-500 hover:text-red-500 transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-4 py-1">
                                <input 
                                  type="range" 
                                  min="1" max="10" 
                                  value={g.priority} 
                                  onChange={(e) => updateGoalPriority(party.id, i, parseInt(e.target.value))}
                                  style={getSliderStyle(g.priority)}
                                />
                                <span className="text-[11px] font-bold text-indigo-500 w-4">{g.priority}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Constraints */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-[12px] uppercase tracking-[0.15em] text-zinc-600 font-bold">Constraints</span>
                          <button onClick={() => addConstraint(party.id)} className="text-zinc-700 hover:text-indigo-400 transition-colors"><Plus size={14}/></button>
                        </div>
                        <div className="space-y-6">
                          {party.constraints.map((c, i) => (
                            <div key={i} className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <input 
                                  className="flex-1 bg-transparent text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-900" 
                                  placeholder="Limit..." 
                                  value={c.text} 
                                  onChange={(e) => updateConstraint(party.id, i, e.target.value)} 
                                />
                                {party.constraints.length > 1 && (
                                  <button 
                                    onClick={() => removeConstraint(party.id, i)}
                                    className="text-zinc-500 hover:text-red-500 transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-4 py-1">
                                <input 
                                  type="range" 
                                  min="1" max="10" 
                                  value={c.priority} 
                                  onChange={(e) => updateConstraintPriority(party.id, i, parseInt(e.target.value))}
                                  style={getSliderStyle(c.priority)}
                                />
                                <span className="text-[11px] font-bold text-indigo-500 w-4">{c.priority}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="flex flex-col items-center py-24 border-t border-white/5">
            <button
              onClick={() => console.log({ scenario, parties })}
              className="group relative px-14 py-5 overflow-hidden rounded-full bg-white text-black font-bold transition-all hover:scale-105 active:scale-95 shadow-2xl"
            >
              <span className="relative z-10 flex items-center gap-3 uppercase text-[12px] tracking-[0.2em]">
                Initialize Swarm <Globe2 size={16} />
              </span>
              <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
            <p className="mt-10 text-[10px] uppercase tracking-[0.4em] text-zinc-700 font-bold">
              Convergent Intelligence Protocol // v1.0.4
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}