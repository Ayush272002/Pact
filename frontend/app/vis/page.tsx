/**
 * @fileoverview Visualisation page for the Pact simulation.
 * Displays force-directed graph, real-time metrics, and agent breakdowns.
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Play, Loader2, CheckCircle2, X } from "lucide-react";

/** Base URL for the backend API. */
const API_BASE_URL = "http://localhost:8000/api";

/**
 * Applies semantic highlighting to negotiation text.
 * Highlights percentages, currency, and temperatures with distinct colours.
 */
function highlightNegotiationTerms(text: string): React.ReactNode {
  // Regex patterns for negotiation-relevant terms
  const patterns = [
    { regex: /(\d+(?:\.\d+)?%)/g, className: "text-indigo-400 font-semibold" }, // Percentages
    {
      regex: /(\$[\d,]+(?:\.\d+)?[BMK]?)/gi,
      className: "text-emerald-400 font-semibold",
    }, // Currency
    {
      regex: /(\d+(?:\.\d+)?°[CF])/g,
      className: "text-amber-400 font-semibold",
    }, // Temperatures
    {
      regex: /(\d+(?:\.\d+)?\s*(?:billion|million|trillion))/gi,
      className: "text-emerald-400 font-semibold",
    }, // Large numbers
  ];

  // Split text into parts and highlight matches
  let parts: Array<{ text: string; className?: string }> = [{ text }];

  for (const { regex, className } of patterns) {
    const newParts: Array<{ text: string; className?: string }> = [];
    for (const part of parts) {
      if (part.className) {
        // Already highlighted, skip
        newParts.push(part);
        continue;
      }
      const splitParts = part.text.split(regex);
      for (let i = 0; i < splitParts.length; i++) {
        if (splitParts[i]) {
          const isMatch = regex.test(splitParts[i]);
          regex.lastIndex = 0; // Reset regex state
          newParts.push({
            text: splitParts[i],
            className: isMatch ? className : undefined,
          });
        }
      }
    }
    parts = newParts;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.className ? (
          <span key={i} className={part.className}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Formats a treaty value for display.
 * Handles percentages (0-1), monetary values, and booleans.
 */
function formatTreatyValue(value: number, key: string): string {
  const keyLower = key.toLowerCase();

  // Boolean-like values (0 or 1)
  if (value === 0 || value === 1) {
    const boolKeys = [
      "binding",
      "veto",
      "authority",
      "enabled",
      "required",
      "mandatory",
    ];
    if (boolKeys.some((k) => keyLower.includes(k))) {
      return value === 1 ? "YES" : "NO";
    }
  }

  // Monetary values: keys containing investment/fund/budget/cost
  const moneyKeys = [
    "investment",
    "fund",
    "budget",
    "cost",
    "spending",
    "capital",
  ];
  if (moneyKeys.some((k) => keyLower.includes(k))) {
    // Assume value is in billions if small, raw if large
    if (value > 1_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}B`;
    }
    return `$${value.toFixed(1)}B`;
  }

  // Large numbers (likely monetary values in raw form)
  if (value > 1_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }

  // Values between 0 and 1 are percentages
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(0)}%`;
  }

  // Values between 1 and 100 might already be percentages
  if (value > 1 && value <= 100) {
    return `${value.toFixed(0)}%`;
  }

  // Default: show as decimal
  return value.toFixed(1);
}

/**
 * Cleans a treaty key for display.
 * Removes verbose phrasing like "Secure X% of..." and extracts the core concept.
 */
function formatTreatyKey(key: string): string {
  let cleaned = key.replace(/_/g, " ");

  // Remove common verbose prefixes
  const prefixes = [
    /^secure\s+\d+%?\s*(of\s+)?/i,
    /^establish\s+(binding\s+)?/i,
    /^gain\s+(majority\s+)?/i,
    /^minimise\s+/i,
    /^minimize\s+/i,
    /^protect\s+/i,
    /^ensure\s+/i,
    /^maintain\s+/i,
    /^achieve\s+/i,
    /^obtain\s+/i,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, "");
  }

  // Truncate if still too long (max 35 chars)
  if (cleaned.length > 35) {
    cleaned = cleaned.slice(0, 32) + "...";
  }

  // Capitalise first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Renders a mini sparkline chart for trend visualisation.
 * Uses pure SVG for lightweight rendering.
 */
function Sparkline({
  data,
  width = 60,
  height = 20,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = data[data.length - 1] - data[0];
  const strokeColour =
    trend > 0 ? "#22c55e" : trend < 0 ? "#ef4444" : "#6366f1";

  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        fill="none"
        stroke={strokeColour}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End dot */}
      <circle
        cx={((data.length - 1) / (data.length - 1)) * width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2"
        fill={strokeColour}
      />
    </svg>
  );
}

/** Node type for D3 force simulation. */
interface AgentNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  group: string;
  val: number; // Influence weight for node size
  sentiment: number; // -1 (conflict) to 1 (consensus)
  politicalCapital: number; // 0-100, agent's negotiating power
  privateMandate?: string; // Hidden agenda (God Mode only)
}

/** Link type for D3 force simulation. */
interface Link extends d3.SimulationLinkDatum<AgentNode> {
  strength: number;
}

/** Chat message from the simulation. */
interface ChatMessage {
  agentId: string;
  epoch: number;
  content: string;
  sentimentDelta: number;
}

/** Treaty state tracking negotiated values. */
interface TreatyState {
  issue_values: Record<string, number>;
  clauses: string[];
  last_updated_epoch: number;
}

/** Simulation state from backend. */
interface SimulationState {
  simulation_id: string;
  current_epoch: number;
  global_tension: number;
  nash_product: number;
  status: string;
  current_treaty: TreatyState;
  agents: Record<
    string,
    {
      agent_id: string;
      name: string;
      archetype: string;
      private_mandate: string;
      political_capital: number;
    }
  >;
  chat_history: Array<{
    agent_id: string;
    epoch: number;
    content: string;
    sentiment_delta: number;
  }>;
  active_alliances: Array<[string, string, number]>;
}

export default function NexusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const simulationId = searchParams.get("id");

  const d3Container = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Simulation state
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [isNextEpochLoading, setIsNextEpochLoading] = useState(false);
  const [globalTension, setGlobalTension] = useState(0.5);
  const [nashProduct, setNashProduct] = useState(0);
  const [prevNashProduct, setPrevNashProduct] = useState(0); // Track previous for delta
  const [initialNashProduct, setInitialNashProduct] = useState<number | null>(
    null,
  ); // Track starting value
  const [nashHistory, setNashHistory] = useState<number[]>([]); // History for sparkline
  const [status, setStatus] = useState("INITIALISING");
  const [lastSpeakingAgent, setLastSpeakingAgent] = useState<string | null>(
    null,
  ); // For pulse animation

  // UI state
  const [godMode, setGodMode] = useState(false); // Toggle to reveal private mandates

  // Graph data
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  // Chat history
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Treaty state (real data from backend)
  const [treatyValues, setTreatyValues] = useState<Record<string, number>>({});

  // Consensus Reached modal state
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  /**
   * Fetch initial simulation state from backend.
   */
  const fetchSimulationState = useCallback(async () => {
    if (!simulationId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/simulation/${simulationId}/state`,
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fetch failed (${response.status}):`, errorText);
        throw new Error(`Failed to fetch simulation state: ${response.status}`);
      }

      const data = await response.json();
      const state: SimulationState = data.state;

      // Transform agents to nodes
      const agentNodes: AgentNode[] = Object.values(state.agents).map(
        (agent, idx) => ({
          id: agent.agent_id,
          name: agent.name,
          group: agent.archetype,
          val: 15 + agent.political_capital / 10, // Size based on political capital
          sentiment: 0, // Will be updated from chat history
          politicalCapital: agent.political_capital,
          privateMandate: agent.private_mandate,
        }),
      );

      // Transform alliances to links
      const allianceLinks: Link[] = state.active_alliances.map(
        ([source, target, strength]) => ({
          source: source as string,
          target: target as string,
          strength: strength as number,
        }),
      );

      // Transform chat history
      const messages: ChatMessage[] = state.chat_history.map((msg) => ({
        agentId: msg.agent_id,
        epoch: msg.epoch,
        content: msg.content,
        sentimentDelta: msg.sentiment_delta,
      }));

      setNodes(agentNodes);
      setLinks(allianceLinks);
      setChatHistory(messages);
      setCurrentEpoch(state.current_epoch);
      setGlobalTension(state.global_tension);
      setNashProduct(state.nash_product);
      // Set initial Nash Product for delta tracking
      if (state.nash_product > 0 && initialNashProduct === null) {
        setInitialNashProduct(state.nash_product);
      }
      setStatus(state.status);
      if (state.current_treaty?.issue_values) {
        setTreatyValues(state.current_treaty.issue_values);
      }
      // Auto-show modal if consensus already reached
      if (state.status === "CONSENSUS_REACHED") {
        setShowProtocolModal(true);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching simulation state:", error);
      setIsLoading(false);
    }
  }, [simulationId]);

  /**
   * Start the SSE stream to receive real-time updates.
   */
  const startStream = useCallback(() => {
    if (!simulationId || eventSourceRef.current) return;

    setIsStreaming(true);
    const eventSource = new EventSource(
      `${API_BASE_URL}/simulation/${simulationId}/stream`,
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "message_added") {
          // Update metrics with delta tracking
          setCurrentEpoch(data.epoch);
          setGlobalTension(data.global_tension);
          setPrevNashProduct(nashProduct); // Store previous before updating
          setNashProduct(data.nash_product);
          // Set initial Nash Product on first meaningful value
          setInitialNashProduct((prev) =>
            prev === null && data.nash_product > 0 ? data.nash_product : prev,
          );
          setNashHistory((prev) => [...prev.slice(-9), data.nash_product]); // Keep last 10 for sparkline
          setLastSpeakingAgent(data.agent_id); // Trigger pulse animation
          setTimeout(() => setLastSpeakingAgent(null), 1500); // Clear after animation

          // Add message to chat history
          setChatHistory((prev) => [
            ...prev,
            {
              agentId: data.agent_id,
              epoch: data.epoch,
              content: data.content,
              sentimentDelta: data.sentiment_delta,
            },
          ]);

          // Update node sentiment and political capital
          setNodes((prev) =>
            prev.map((node) => {
              const newCapital =
                data.agent_capitals?.[node.id] ?? node.politicalCapital;
              return {
                ...node,
                sentiment:
                  node.id === data.agent_id
                    ? Math.max(
                        -1,
                        Math.min(1, node.sentiment + data.sentiment_delta),
                      )
                    : node.sentiment,
                politicalCapital: newCapital,
                val: 15 + newCapital / 10, // Update node size based on capital
              };
            }),
          );

          // Update treaty values
          if (
            data.treaty_values &&
            Object.keys(data.treaty_values).length > 0
          ) {
            setTreatyValues(data.treaty_values);
          }

          // Update status from SSE (tracks CONSENSUS_REACHED, DEADLOCK, etc.)
          if (data.status) {
            setStatus(data.status);
          }
        } else if (data.type === "coalitions_detected") {
          // Update alliances/links
          const newLinks: Link[] = data.alliances.map(
            ([source, target, strength]: [string, string, number]) => ({
              source,
              target,
              strength,
            }),
          );
          setLinks(newLinks);
        } else if (data.type === "simulation_complete") {
          // Use actual status from backend (CONSENSUS_REACHED, DEADLOCK, or COMPLETE)
          setStatus(data.status || "COMPLETE");
          setIsStreaming(false);
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [simulationId]);

  /**
   * Advance simulation by one step (manual control).
   */
  const stepSimulation = async () => {
    if (!simulationId) return;

    try {
      setIsNextEpochLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/simulation/${simulationId}/step`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to step simulation");
      setIsNextEpochLoading(false);

      // Refresh state after step
      await fetchSimulationState();
    } catch (error) {
      console.error("Error stepping simulation:", error);
      setIsNextEpochLoading(false);
    }
  };

  // Redirect if no simulation ID
  useEffect(() => {
    if (!simulationId) {
      router.push("/simulate");
      return;
    }
    fetchSimulationState();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [simulationId, router, fetchSimulationState]);

  // Auto-show Consensus Reached modal when consensus reached (only once)
  useEffect(() => {
    if (
      status === "CONSENSUS_REACHED" &&
      !showProtocolModal &&
      !modalDismissed
    ) {
      // Small delay for dramatic effect
      const timer = setTimeout(() => setShowProtocolModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [status, showProtocolModal, modalDismissed]);

  // D3 force simulation -- re-render when nodes/links change
  useEffect(() => {
    if (!d3Container.current || nodes.length === 0) return;
    const speakingAgentId = lastSpeakingAgent;

    const container = d3Container.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous SVG
    d3.select(container).selectAll("*").remove();

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    // Create mutable copies for D3
    const nodesCopy = nodes.map((d) => ({ ...d }));
    const linksCopy = links.map((d) => ({ ...d }));

    // Force Simulation -- tighter spacing for better visual density
    const nodeCount = nodesCopy.length;
    const linkDistance = nodeCount <= 3 ? 350 : nodeCount <= 5 ? 300 : 200;

    const simulation = d3
      .forceSimulation<AgentNode>(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<AgentNode, Link>(linksCopy)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength((d) => d.strength * 0.8),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<AgentNode>().radius((d) => d.val + 15),
      )
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    // Draw Links -- colour based on alliance strength
    const link = svg
      .append("g")
      .selectAll("line")
      .data(linksCopy)
      .join("line")
      .attr("stroke", (d) => (d.strength > 0.5 ? "#22c55e" : "#ef4444"))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.max(1, d.strength * 4));

    // Draw Nodes
    const node = svg
      .append("g")
      .selectAll<SVGGElement, AgentNode>("g")
      .data(nodesCopy)
      .join("g")
      .call(
        d3
          .drag<SVGGElement, AgentNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      );

    // Node circle -- single circle with sentiment-based colour and subtle fill
    node
      .append("circle")
      .attr("r", (d) => d.val)
      .attr("fill", (d) =>
        speakingAgentId === d.id
          ? "rgba(99, 102, 241, 0.15)" // Indigo glow when speaking
          : d.sentiment > 0.2
            ? "rgba(34, 197, 94, 0.1)"
            : d.sentiment < -0.2
              ? "rgba(239, 68, 68, 0.1)"
              : "rgba(245, 158, 11, 0.08)",
      )
      .attr("stroke", (d) =>
        speakingAgentId === d.id
          ? "#6366f1" // Indigo when speaking
          : d.sentiment > 0.2
            ? "#22c55e"
            : d.sentiment < -0.2
              ? "#ef4444"
              : "#f59e0b",
      )
      .attr("stroke-width", (d) => (speakingAgentId === d.id ? 3 : 2))
      .style("transition", "all 0.3s ease-out");

    // Labels -- show agent name with background for readability, using foreignObject for text wrapping
    node
      .append("foreignObject")
      .attr("width", 120)
      .attr("height", 60)
      .attr("x", -60)
      .attr("y", (d) => d.val + 12)
      .append("xhtml:div")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("align-items", "flex-start")
      .style("width", "100%")
      .style("height", "100%")
      .style("text-align", "center")
      .style("word-wrap", "break-word")
      .style("overflow-wrap", "break-word")
      .style("hyphens", "auto")
      .append("xhtml:span")
      .style("color", "#e4e4e7")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .style("text-transform", "uppercase")
      .style("text-shadow", "0 0 3px #09090b, 0 0 3px #09090b, 0 0 3px #09090b")
      .style("line-height", "1.2")
      .text((d) => d.name || d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as AgentNode).x ?? 0)
        .attr("y1", (d) => (d.source as AgentNode).y ?? 0)
        .attr("x2", (d) => (d.target as AgentNode).x ?? 0)
        .attr("y2", (d) => (d.target as AgentNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    function dragstarted(
      event: d3.D3DragEvent<SVGGElement, AgentNode, AgentNode>,
    ) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event: d3.D3DragEvent<SVGGElement, AgentNode, AgentNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(
      event: d3.D3DragEvent<SVGGElement, AgentNode, AgentNode>,
    ) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, lastSpeakingAgent]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#030303] text-white items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="animate-spin text-indigo-500" />
          <p className="text-zinc-400 text-sm uppercase tracking-widest">
            Loading Simulation...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen bg-[#030303] text-white overflow-hidden font-sans transition-all ${
        godMode ? "ring-1 ring-inset ring-amber-500/30" : ""
      }`}
    >
      {/* LEFT SIDEBAR: Controls & Diplomatic Feed */}
      <aside className="w-1/3 border-r border-white/5 flex flex-col bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="hover:text-indigo-400 transition-colors"
                >
                  <h2 className="text-lg font-bold tracking-widest uppercase">
                    Pact
                  </h2>
                </Link>
                {isStreaming && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <p className="text-[9px] font-mono text-zinc-600 tracking-wider">
                NASH_ENGINE // ID:{simulationId?.slice(0, 6)}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                status === "CONSENSUS_REACHED"
                  ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                  : status === "DEADLOCK"
                    ? "text-red-400 border-red-500/20 bg-red-500/5"
                    : status === "COMPLETE"
                      ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
                      : isStreaming
                        ? "text-indigo-400 border-indigo-500/20 bg-indigo-500/5"
                        : "text-zinc-400 border-zinc-500/20 bg-zinc-500/5"
              }
            >
              {status === "CONSENSUS_REACHED"
                ? "Treaty Signed"
                : status === "DEADLOCK"
                  ? "Deadlock"
                  : status === "COMPLETE"
                    ? "Complete"
                    : isStreaming
                      ? "Live"
                      : "Ready"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {status === "CONSENSUS_REACHED" ? (
              <Button
                size="sm"
                className="col-span-2 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                onClick={() => setShowProtocolModal(true)}
              >
                <CheckCircle2 size={12} className="mr-1" />
                RATIFIED — View Treaty
              </Button>
            ) : status === "DEADLOCK" ? (
              <Button
                size="sm"
                className="col-span-2 bg-red-900/50 text-red-100 text-xs cursor-not-allowed border border-red-500/30"
                disabled
              >
                <X size={12} className="mr-1" />
                DEADLOCK — No Agreement
              </Button>
            ) : !isStreaming ? (
              <>
                <Button
                  size="sm"
                  className="bg-white text-black text-xs hover:bg-zinc-200"
                  onClick={stepSimulation}
                  disabled={status === "COMPLETE" || isNextEpochLoading}
                >
                  {isNextEpochLoading ? (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  ) : (
                    "Next Epoch"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-white/10 hover:bg-white/5"
                  onClick={startStream}
                  disabled={status === "COMPLETE" || isNextEpochLoading}
                >
                  {isNextEpochLoading ? (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  ) : (
                    <>
                      <Play size={12} className="mr-1" />
                      Auto-run
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="col-span-2 text-xs border-white/10 hover:bg-white/5"
                disabled
              >
                <Loader2 size={12} className="mr-1 animate-spin" />
                Running...
              </Button>
            )}
          </div>

          {/* God Mode Toggle */}
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => setGodMode(!godMode)}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors ${
                godMode
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest">
                God Mode
              </span>
              {godMode ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {godMode && (
              <p className="text-[9px] text-amber-500/70 mt-1 px-2">
                Private mandates visible
              </p>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
              Diplomatic Channels
            </h4>
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-600">No messages yet</p>
                <p className="text-xs text-zinc-700 mt-1">
                  Start the simulation to see agent communications
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatHistory
                  .slice(-15)
                  .reverse()
                  .map((msg, i) => {
                    // Find the agent name from nodes
                    const agentNode = nodes.find((n) => n.id === msg.agentId);
                    const agentName =
                      agentNode?.name || msg.agentId.slice(0, 8);

                    return (
                      <div key={i} className="flex gap-0 group">
                        {/* Sentiment indicator bar */}
                        <div
                          className={`w-1 rounded-l-lg shrink-0 transition-all ${
                            msg.sentimentDelta > 0
                              ? "bg-emerald-500"
                              : msg.sentimentDelta < 0
                                ? "bg-red-500"
                                : "bg-zinc-700"
                          }`}
                        />
                        <div
                          className={`flex-1 p-3 rounded-r-lg border-y border-r transition-all group-hover:border-white/10 ${
                            msg.sentimentDelta > 0
                              ? "border-emerald-500/20 bg-emerald-500/5"
                              : msg.sentimentDelta < 0
                                ? "border-red-500/20 bg-red-500/5"
                                : "border-zinc-700/50 bg-zinc-800/30"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs font-medium ${
                                msg.sentimentDelta > 0
                                  ? "text-emerald-400"
                                  : msg.sentimentDelta < 0
                                    ? "text-red-400"
                                    : "text-zinc-300"
                              }`}
                            >
                              {agentName}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono">
                              E{msg.epoch.toString().padStart(2, "0")}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {highlightNegotiationTerms(msg.content)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* CENTER: The Swarm Canvas */}
      <main className="flex-1 relative">
        {/* HUD Overlays -- Real-time metrics */}
        <div className="absolute top-8 left-8 z-10 flex gap-12">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Global Tension
            </p>
            <p
              className={`text-3xl font-light tracking-tighter font-mono ${
                globalTension < 0.4
                  ? "text-emerald-400"
                  : globalTension < 0.7
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {(globalTension * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Nash Product
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <p
                  className={`text-3xl font-light tracking-tighter font-mono ${
                    nashProduct > prevNashProduct && prevNashProduct > 0
                      ? "text-emerald-400"
                      : nashProduct < prevNashProduct
                        ? "text-red-400"
                        : "text-indigo-400"
                  }`}
                >
                  {nashProduct < 0.01 ? "0.00" : nashProduct.toFixed(2)}
                </p>
                {/* Show delta from initial value */}
                {nashProduct >= 0.01 &&
                  initialNashProduct !== null &&
                  initialNashProduct > 0 && (
                    <span
                      className={`text-xs font-medium font-mono ${
                        nashProduct > initialNashProduct
                          ? "text-emerald-400"
                          : nashProduct < initialNashProduct
                            ? "text-red-400"
                            : "text-zinc-500"
                      }`}
                    >
                      ({nashProduct > initialNashProduct ? "+" : ""}
                      {(nashProduct - initialNashProduct).toFixed(2)})
                    </span>
                  )}
              </div>
              {nashHistory.length >= 2 && (
                <Sparkline data={nashHistory} width={50} height={18} />
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Epoch
            </p>
            <p className="text-3xl font-light tracking-tighter font-mono text-zinc-200">
              {currentEpoch.toString().padStart(2, "0")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
              Active Nodes
            </p>
            <p className="text-3xl font-light tracking-tighter font-mono text-zinc-200">
              {nodes.length.toString().padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* D3 Canvas with subtle grid background */}
        <div
          ref={d3Container}
          className="w-full h-full cursor-crosshair"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Draft State Widget -- Shows real treaty values from backend */}
        {Object.keys(treatyValues).length > 0 && (
          <div className="absolute bottom-20 left-8 z-50 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-4 min-w-50 font-mono shadow-xl">
            <div className="text-zinc-400 border-b border-zinc-700 mb-3 pb-2 text-[10px] uppercase tracking-widest">
              Current Draft Terms
            </div>
            <div className="space-y-2">
              {Object.entries(treatyValues).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center text-xs"
                >
                  <span
                    className="text-teal-400"
                    title={key.replace(/_/g, " ")}
                  >
                    {formatTreatyKey(key)}
                  </span>
                  <span className="text-white font-medium">
                    {formatTreatyValue(value, key)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graph Legend */}
        <div className="absolute bottom-16 right-8 z-50 bg-zinc-900/80 backdrop-blur-sm border border-white/10 rounded-lg p-3 space-y-2 shadow-xl">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">
            Legend
          </p>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-emerald-500 rounded" />
            <span className="text-[10px] text-zinc-400">Strong Agreement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500 rounded" />
            <span className="text-[10px] text-zinc-400">Conflict</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-transparent" />
            <span className="text-[10px] text-zinc-400">Cooperative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500 bg-transparent" />
            <span className="text-[10px] text-zinc-400">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" />
            <span className="text-[10px] text-zinc-400">Adversarial</span>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="absolute bottom-0 w-full p-4 flex justify-between items-center bg-linear-to-t from-black to-transparent">
          <div className="flex items-center gap-6 text-[10px] text-zinc-500">
            <span>ID: {simulationId?.slice(0, 8)}</span>
            <span className="flex items-center gap-1">
              {isStreaming && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {status}
            </span>
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR: Agent Insights */}
      <aside className="w-1/6 border-l border-white/5 bg-zinc-950/20 hidden lg:flex flex-col">
        <div className="p-5 border-b border-white/5">
          <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            Negotiating Parties
          </h4>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {nodes.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">
                No agents loaded
              </p>
            ) : (
              nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-4 rounded-lg border transition-all ${
                    node.sentiment > 0.2
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : node.sentiment < -0.2
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-zinc-700/50 bg-zinc-800/30"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-sm font-medium text-white block">
                        {node.name || node.id}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        {node.group}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        node.sentiment > 0.2
                          ? "text-emerald-400 bg-emerald-500/10"
                          : node.sentiment < -0.2
                            ? "text-red-400 bg-red-500/10"
                            : "text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {node.sentiment > 0.2
                        ? "Cooperative"
                        : node.sentiment < -0.2
                          ? "Adversarial"
                          : "Neutral"}
                    </span>
                  </div>

                  {/* Political Capital bar */}
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        Political Capital
                      </span>
                      <span
                        className={`text-[11px] font-mono font-medium ${
                          node.politicalCapital > 70
                            ? "text-emerald-400"
                            : node.politicalCapital > 30
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {node.politicalCapital}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          node.politicalCapital > 70
                            ? "bg-emerald-500"
                            : node.politicalCapital > 30
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${node.politicalCapital}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-zinc-600 italic">
                      {node.politicalCapital > 70
                        ? "Strong negotiating position"
                        : node.politicalCapital > 30
                          ? "Moderate influence"
                          : "At risk of withdrawal"}
                    </p>
                  </div>

                  {/* God Mode: Show private mandate */}
                  {godMode && node.privateMandate && (
                    <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
                      <p className="text-[10px] text-amber-500 uppercase tracking-wider font-medium mb-1">
                        Hidden Agenda
                      </p>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        "{node.privateMandate}"
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Consensus Reached Modal */}
      {showProtocolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#030303] border border-white/10 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-400" size={16} />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
                    Consensus Reached
                  </h2>
                </div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  ID: {simulationId?.slice(0, 8)} • Ratified at Epoch{" "}
                  {currentEpoch}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProtocolModal(false);
                  setModalDismissed(true);
                }}
                className="text-zinc-600 hover:text-white transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Section 1: Ratified Terms */}
              <section>
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">
                  Ratified Terms
                </h3>
                <div className="space-y-px">
                  {Object.entries(treatyValues).map(([key, finalValue]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] transition-colors"
                    >
                      <span
                        className="text-xs text-zinc-400 pr-4"
                        title={key.replace(/_/g, " ")}
                      >
                        {formatTreatyKey(key)}
                      </span>
                      <span className="text-xs text-white font-mono shrink-0">
                        {formatTreatyValue(finalValue, key)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 2: Signatories */}
              <section>
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">
                  Signatories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/5 text-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-white">{node.name}</span>
                      <span className="text-zinc-600 text-[10px]">
                        {node.group}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Metrics */}
              <section className="grid grid-cols-2 gap-px bg-white/5">
                <div className="p-4 bg-[#030303]">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                    Nash Product
                  </p>
                  <p className="text-2xl font-light text-white">
                    {nashProduct.toFixed(3)}
                    {initialNashProduct !== null && (
                      <span
                        className={`text-xs ml-2 ${nashProduct >= initialNashProduct ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {nashProduct >= initialNashProduct ? "+" : ""}
                        {(nashProduct - initialNashProduct).toFixed(3)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-4 bg-[#030303]">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                    Final Tension
                  </p>
                  <p
                    className={`text-2xl font-light ${
                      globalTension < 0.3
                        ? "text-emerald-400"
                        : globalTension < 0.6
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {(globalTension * 100).toFixed(0)}%
                  </p>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 px-6 py-4 flex justify-end shrink-0">
              <Button
                onClick={() => {
                  setShowProtocolModal(false);
                  setModalDismissed(true);
                }}
                className="bg-white text-black hover:bg-zinc-200 px-6 text-xs font-semibold uppercase tracking-wider"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
