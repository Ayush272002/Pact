"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Zap, Target, ShieldAlert, ChevronRight } from "lucide-react";

// Types for our Swarm
interface AgentNode extends d3.SimulationNodeDatum {
  id: string;
  group: string;
  val: number; // Influence/Weight
  sentiment: number; // -1 (Conflict) to 1 (Consensus)
}

interface Link extends d3.SimulationLinkDatum<AgentNode> {
  strength: number;
}

export default function NexusPage() {
  const d3Container = useRef(null);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [stability, setStability] = useState(64);

  // Mock Data for Initial Swarm
  const nodes: AgentNode[] = [
    { id: "Aggressor_Alpha", group: "Opposition", val: 20, sentiment: -0.8 },
    { id: "Mediator_01", group: "Neutral", val: 15, sentiment: 0.2 },
    { id: "Proponent_Beta", group: "Advocate", val: 18, sentiment: 0.9 },
    { id: "Lobbyist_Gamma", group: "Opposition", val: 12, sentiment: -0.4 },
    { id: "Neutral_Node", group: "Neutral", val: 10, sentiment: 0.1 },
  ];

  const links: Link[] = [
    { source: "Aggressor_Alpha", target: "Mediator_01", strength: 1 },
    { source: "Proponent_Beta", target: "Mediator_01", strength: 1 },
    { source: "Lobbyist_Gamma", target: "Aggressor_Alpha", strength: 0.5 },
  ];

  useEffect(() => {
    if (nodes && d3Container.current) {
      const width = d3Container.current.clientWidth;
      const height = d3Container.current.clientHeight;

      // Clear previous SVG
      d3.select(d3Container.current).selectAll("*").remove();

      const svg = d3
        .select(d3Container.current)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", [0, 0, width, height]);

      // Force Simulation
      const simulation = d3
        .forceSimulation<AgentNode>(nodes)
        .force(
          "link",
          d3
            .forceLink<AgentNode, Link>(links)
            .id((d) => d.id)
            .distance(150),
        )
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force(
          "collision",
          d3.forceCollide().radius((d) => d.val + 20),
        );

      // Draw Links
      const link = svg
        .append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#27272a")
        .attr("stroke-width", (d) => d.strength * 2)
        .attr("stroke-dasharray", "4,4");

      // Draw Nodes
      const node = svg
        .append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(
          d3
            .drag<SVGGElement, AgentNode>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended),
        );

      // Node Glow/Outer Circle
      node
        .append("circle")
        .attr("r", (d) => d.val + 10)
        .attr("fill", (d) =>
          d.sentiment > 0
            ? "rgba(34, 197, 94, 0.05)"
            : "rgba(239, 68, 68, 0.05)",
        )
        .attr("stroke", (d) => (d.sentiment > 0 ? "#22c55e" : "#ef4444"))
        .attr("stroke-width", 1)
        .attr("class", "animate-pulse");

      // Core Node
      node
        .append("circle")
        .attr("r", (d) => d.val)
        .attr("fill", "#09090b")
        .attr("stroke", "#3f3f46")
        .attr("stroke-width", 2);

      // Labels
      node
        .append("text")
        .text((d) => d.id)
        .attr("fill", "#71717a")
        .attr("font-size", "10px")
        .attr("dy", (d) => d.val + 25)
        .attr("text-anchor", "middle")
        .attr("class", "uppercase tracking-tighter");

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => (d.source as any).x)
          .attr("y1", (d) => (d.source as any).y)
          .attr("x2", (d) => (d.target as any).x)
          .attr("y2", (d) => (d.target as any).y);

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }
  }, []);

  return (
    <div className="flex h-screen bg-[#030303] text-white overflow-hidden font-sans">
      {/* LEFT SIDEBAR: Ledger & Control */}
      <aside className="w-80 border-r border-white/5 flex flex-col bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Epoch Control
            </span>
            <Badge
              variant="outline"
              className="text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
            >
              Live
            </Badge>
          </div>
          <h2 className="text-xl font-light italic">Pact</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="bg-white text-black text-xs hover:bg-zinc-200"
              onClick={() => setCurrentEpoch((e) => e + 1)}
            >
              Next Epoch
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-white/10 hover:bg-white/5"
            >
              Reset
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">
                Intent Vector Log
              </h4>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="mb-4 p-3 border-l border-indigo-500/30 bg-indigo-500/5 space-y-1"
                >
                  <div className="flex justify-between text-[9px] text-indigo-300">
                    <span>AGENT_BETA</span>
                    <span>EPOCH_{currentEpoch - i}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 italic">
                    "Proposing 15% reduction in node dependency to stabilize
                    P(Deal)."
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </aside>

      {/* CENTER: The Swarm Canvas */}
      <main className="flex-1 relative">
        {/* HUD Overlays */}
        <div className="absolute top-8 left-8 z-10 flex gap-12">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              P(Stability)
            </p>
            <p className="text-3xl font-light tracking-tighter text-emerald-400">
              {stability}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Active Nodes
            </p>
            <p className="text-3xl font-light tracking-tighter">05</p>
          </div>
        </div>

        {/* D3 Canvas */}
        <div ref={d3Container} className="w-full h-full cursor-crosshair" />

        {/* Bottom Status Bar */}
        <div className="absolute bottom-0 w-full p-4 flex justify-between items-center bg-gradient-to-t from-black to-transparent">
          <div className="flex items-center gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Activity size={12} /> Monte Carlo: 10k iters/s
            </span>
            <span className="flex items-center gap-1">
              <Zap size={12} /> Latency: 42ms
            </span>
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR: Agent Insights */}
      <aside className="w-64 border-l border-white/5 bg-zinc-950/20 p-6 hidden lg:block">
        <h4 className="text-[10px] uppercase tracking-widest text-zinc-600 mb-6">
          Agent Breakdown
        </h4>
        <div className="space-y-8">
          {nodes.map((node) => (
            <div key={node.id} className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-medium">{node.id}</span>
                <span
                  className={`text-[10px] ${node.sentiment > 0 ? "text-emerald-500" : "text-red-500"}`}
                >
                  {Math.abs(node.sentiment * 100)}%{" "}
                  {node.sentiment > 0 ? "Co-op" : "Adversarial"}
                </span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${node.sentiment > 0 ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${Math.abs(node.sentiment * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
