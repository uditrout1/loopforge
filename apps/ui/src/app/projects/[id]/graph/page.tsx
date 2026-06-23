"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  getGraphSummary,
  getGraphNodes,
  getGraphNode,
  getGraphUpstream,
  getGraphDownstream,
  searchGraph,
  type GraphSummary,
  type GraphNodeData,
  type GraphEdgeData,
} from "@/lib/api";

// ─── Colour palette ───────────────────────────────────────────────────────────

const ENTITY_LAYERS: Record<string, string> = {
  prd: "#6366f1",
  requirement: "#6366f1",
  acceptance_criteria: "#6366f1",
  user_story: "#6366f1",
  architecture_doc: "#0ea5e9",
  adr: "#0ea5e9",
  technical_decision: "#0ea5e9",
  repository: "#22c55e",
  module: "#22c55e",
  file: "#22c55e",
  api_endpoint: "#22c55e",
  database_table: "#22c55e",
  epic: "#f59e0b",
  ticket: "#f59e0b",
  pull_request: "#f59e0b",
  release: "#f59e0b",
  spec: "#6366f1",
  evaluation: "#ef4444",
  eval_run: "#ef4444",
  test_suite: "#ef4444",
  compliance_check: "#ef4444",
  visual_asset: "#a855f7",
  design_component: "#a855f7",
  wireframe: "#a855f7",
};

function nodeColor(entityType: string): string {
  return ENTITY_LAYERS[entityType] ?? "#888";
}

// ─── Force simulation (static layout) ─────────────────────────────────────────

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data: GraphNodeData;
}

interface SimEdge {
  source: string;
  target: string;
  data: GraphEdgeData;
}

function runForceSimulation(
  nodes: GraphNodeData[],
  edges: GraphEdgeData[],
  width: number,
  height: number
): SimNode[] {
  const simNodes: SimNode[] = nodes.map((n, i) => ({
    id: n.id,
    x: width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: height / 2 + (Math.random() - 0.5) * height * 0.6,
    vx: 0,
    vy: 0,
    data: n,
  }));

  const nodeMap = new Map<string, SimNode>();
  for (const n of simNodes) nodeMap.set(n.id, n);

  const ITERATIONS = 300;
  const REPULSION = 3000;
  const SPRING_LENGTH = 120;
  const SPRING_STRENGTH = 0.05;
  const CENTER_STRENGTH = 0.01;
  const DAMPING = 0.85;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const src = nodeMap.get(edge.sourceNodeId);
      const tgt = nodeMap.get(edge.targetNodeId);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - SPRING_LENGTH;
      const fx = (dx / dist) * displacement * SPRING_STRENGTH;
      const fy = (dy / dist) * displacement * SPRING_STRENGTH;
      src.vx += fx;
      src.vy += fy;
      tgt.vx -= fx;
      tgt.vy -= fy;
    }

    // Centering force
    for (const n of simNodes) {
      n.vx += (width / 2 - n.x) * CENTER_STRENGTH;
      n.vy += (height / 2 - n.y) * CENTER_STRENGTH;
    }

    // Apply velocity with damping
    for (const n of simNodes) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      // Keep within bounds
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }
  }

  return simNodes;
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawGraph(
  ctx: CanvasRenderingContext2D,
  simNodes: SimNode[],
  simEdges: SimEdge[],
  selectedId: string | null,
  highlightIds: Set<string>,
  mode: string
) {
  const nodeMap = new Map<string, SimNode>();
  for (const n of simNodes) nodeMap.set(n.id, n);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw edges
  for (const edge of simEdges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Arrowhead
    const arrowLen = 10;
    const arrowAngle = Math.PI / 6;
    const endX = tgt.x - (dx / dist) * 14;
    const endY = tgt.y - (dy / dist) * 14;
    const angle = Math.atan2(dy, dx);

    const isHighlighted =
      highlightIds.has(edge.source) && highlightIds.has(edge.target);
    ctx.strokeStyle = isHighlighted
      ? mode === "impact"
        ? "#f59e0b"
        : "#6366f1"
      : "#2a2a2a";
    ctx.lineWidth = isHighlighted ? 1.5 : 1;

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw arrowhead triangle
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle - arrowAngle),
      endY - arrowLen * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle + arrowAngle),
      endY - arrowLen * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();
  }

  // Draw nodes
  const NODE_RADIUS = 12;
  for (const node of simNodes) {
    const isSelected = node.id === selectedId;
    const isHighlighted = highlightIds.has(node.id);
    const color = nodeColor(node.data.entityType);

    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);

    if (isHighlighted) {
      ctx.fillStyle =
        mode === "impact"
          ? "#f59e0b"
          : mode === "lineage"
          ? "#6366f1"
          : color;
    } else {
      ctx.fillStyle = isSelected ? color : color + "66";
    }
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "#cccccc";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const label =
      node.data.title.length > 20
        ? node.data.title.slice(0, 18) + "…"
        : node.data.title;
    ctx.fillText(label, node.x, node.y + NODE_RADIUS + 12);
  }
}

// ─── Main page component ───────────────────────────────────────────────────────

type Mode = "explore" | "impact" | "lineage";

export default function GraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [allNodes, setAllNodes] = useState<GraphNodeData[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdgeData[]>([]);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("explore");
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [selectedEdgesOut, setSelectedEdgesOut] = useState<GraphEdgeData[]>([]);
  const [selectedEdgesIn, setSelectedEdgesIn] = useState<GraphEdgeData[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);

  // Load data
  useEffect(() => {
    async function load() {
      if (!projectId) return;
      try {
        setLoading(true);
        const [sum, nodes] = await Promise.all([
          getGraphSummary(projectId),
          getGraphNodes(projectId),
        ]);
        setSummary(sum);
        setAllNodes(nodes);

        // Fetch edges for all nodes via node detail calls (batch)
        // For simplicity, collect edges by fetching first 50 nodes' details
        const edgeSet = new Map<string, GraphEdgeData>();
        const batch = nodes.slice(0, 50);
        await Promise.all(
          batch.map(async (n) => {
            try {
              const detail = await getGraphNode(projectId, n.id);
              for (const e of [...detail.edgesOut, ...detail.edgesIn]) {
                edgeSet.set(e.id, e);
              }
            } catch {
              // ignore individual node errors
            }
          })
        );
        const edges = Array.from(edgeSet.values());
        setAllEdges(edges);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [projectId]);

  // Run force simulation when nodes/edges change
  useEffect(() => {
    if (allNodes.length === 0) return;
    const canvas = canvasRef.current;
    const w = canvas?.width ?? 800;
    const h = canvas?.height ?? 600;
    const sim = runForceSimulation(allNodes, allEdges, w, h);
    setSimNodes(sim);
    simNodesRef.current = sim;
  }, [allNodes, allEdges]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const visibleNodes = searchQuery
      ? simNodes.filter((n) =>
          n.data.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : simNodes;

    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges: SimEdge[] = allEdges
      .filter(
        (e) => visibleIds.has(e.sourceNodeId) && visibleIds.has(e.targetNodeId)
      )
      .map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, data: e }));

    drawGraph(
      ctx,
      visibleNodes,
      visibleEdges,
      selectedNode?.id ?? null,
      highlightIds,
      mode
    );
  }, [simNodes, allEdges, selectedNode, highlightIds, mode, searchQuery]);

  // Click handling on canvas
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const NODE_RADIUS = 12;
      const visibleNodes = searchQuery
        ? simNodesRef.current.filter((n) =>
            n.data.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : simNodesRef.current;

      const clicked = visibleNodes.find((n) => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 4;
      });

      if (!clicked) {
        setSelectedNode(null);
        setHighlightIds(new Set());
        setSelectedEdgesOut([]);
        setSelectedEdgesIn([]);
        return;
      }

      setSelectedNode(clicked.data);

      try {
        const detail = await getGraphNode(projectId, clicked.id);
        setSelectedEdgesOut(detail.edgesOut);
        setSelectedEdgesIn(detail.edgesIn);
      } catch {
        // ignore
      }

      if (mode === "impact") {
        try {
          const downstream = await getGraphDownstream(projectId, clicked.id);
          const ids = new Set([clicked.id, ...downstream.nodes.map((n) => n.id)]);
          setHighlightIds(ids);
        } catch {
          setHighlightIds(new Set([clicked.id]));
        }
      } else if (mode === "lineage") {
        try {
          const upstream = await getGraphUpstream(projectId, clicked.id);
          const ids = new Set([clicked.id, ...upstream.nodes.map((n) => n.id)]);
          setHighlightIds(ids);
        } catch {
          setHighlightIds(new Set([clicked.id]));
        }
      } else {
        setHighlightIds(new Set([clicked.id]));
      }
    },
    [projectId, mode, searchQuery]
  );

  const byTypeEntries = summary
    ? Object.entries(summary.byType).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/projects/${projectId}`}
          style={{ color: "#555", textDecoration: "none", fontSize: "13px" }}
        >
          ← Back
        </Link>
        <span style={{ color: "#333" }}>|</span>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#f0f0f0" }}>
          Knowledge Graph
        </span>

        {summary && (
          <span style={{ fontSize: "12px", color: "#555" }}>
            {summary.nodeCount} nodes · {summary.edgeCount} edges
            {byTypeEntries.length > 0 && (
              <>
                {" · "}
                {byTypeEntries
                  .map(([type, count]) => `${count} ${type}`)
                  .join(", ")}
              </>
            )}
          </span>
        )}

        {/* Mode toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          {(["explore", "impact", "lineage"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setHighlightIds(new Set());
              }}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "1px solid #2a2a2a",
                background: mode === m ? "#1e1e1e" : "transparent",
                color: mode === m ? "#f0f0f0" : "#555",
                fontSize: "12px",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search nodes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: "#111",
            border: "1px solid #2a2a2a",
            borderRadius: "6px",
            padding: "6px 12px",
            color: "#e8e8e8",
            fontSize: "12px",
            width: "180px",
            outline: "none",
          }}
        />
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#444",
                fontSize: "13px",
              }}
            >
              Loading graph…
            </div>
          )}
          {error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}
          {!loading && allNodes.length === 0 && !error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#444",
                fontSize: "13px",
              }}
            >
              No nodes yet. Create specs, tickets, or ADRs to populate the graph.
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={900}
            height={700}
            onClick={handleCanvasClick}
            style={{
              width: "100%",
              height: "100%",
              cursor: "crosshair",
              display: "block",
            }}
          />
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div
            style={{
              width: "300px",
              background: "#1a1a1a",
              borderLeft: "1px solid #2a2a2a",
              padding: "20px",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "inline-block",
                background: nodeColor(selectedNode.entityType) + "22",
                color: nodeColor(selectedNode.entityType),
                border: `1px solid ${nodeColor(selectedNode.entityType)}44`,
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "11px",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {selectedNode.entityType}
            </div>

            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#f0f0f0",
                marginBottom: "16px",
                lineHeight: 1.4,
              }}
            >
              {selectedNode.title}
            </h2>

            {/* Content preview */}
            {typeof selectedNode.metadata["preview"] === "string" && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  Content
                </p>
                <p style={{ fontSize: "11px", color: "#666", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#111", padding: "8px", borderRadius: "5px", maxHeight: "140px", overflowY: "auto" }}>
                  {String(selectedNode.metadata["preview"]).slice(0, 600)}
                </p>
              </div>
            )}

            {/* Source doc */}
            {typeof selectedNode.metadata["sourceDoc"] === "string" && (
              <p style={{ fontSize: "10px", color: "#333", fontFamily: "monospace", marginBottom: "12px" }}>
                {String(selectedNode.metadata["sourceDoc"])}
              </p>
            )}

            {/* Outgoing edges */}
            {selectedEdgesOut.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                  Outgoing ({selectedEdgesOut.length})
                </p>
                {selectedEdgesOut.slice(0, 12).map((e) => {
                  const tgtNode = allNodes.find((n) => n.id === e.targetNodeId);
                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        if (tgtNode) { setSelectedNode(tgtNode); setHighlightIds(new Set([tgtNode.id])); }
                      }}
                      style={{ fontSize: "11px", color: "#777", marginBottom: "6px", lineHeight: 1.4, cursor: tgtNode ? "pointer" : "default", padding: "4px 6px", borderRadius: "4px", background: "#111" }}
                    >
                      <span style={{ color: "#0ea5e9", fontSize: "10px" }}>{e.relationship}</span>
                      <br />
                      <span style={{ color: tgtNode ? "#aaa" : "#444" }}>
                        {tgtNode ? tgtNode.title : e.targetNodeId}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Incoming edges */}
            {selectedEdgesIn.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                  Incoming ({selectedEdgesIn.length})
                </p>
                {selectedEdgesIn.slice(0, 12).map((e) => {
                  const srcNode = allNodes.find((n) => n.id === e.sourceNodeId);
                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        if (srcNode) { setSelectedNode(srcNode); setHighlightIds(new Set([srcNode.id])); }
                      }}
                      style={{ fontSize: "11px", color: "#777", marginBottom: "6px", lineHeight: 1.4, cursor: srcNode ? "pointer" : "default", padding: "4px 6px", borderRadius: "4px", background: "#111" }}
                    >
                      <span style={{ color: srcNode ? "#aaa" : "#444" }}>
                        {srcNode ? srcNode.title : e.sourceNodeId}
                      </span>
                      <br />
                      <span style={{ color: "#0ea5e9", fontSize: "10px" }}>{e.relationship}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upstream / Downstream buttons */}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={async () => {
                  try {
                    const up = await getGraphUpstream(projectId, selectedNode.id);
                    setHighlightIds(
                      new Set([selectedNode.id, ...up.nodes.map((n) => n.id)])
                    );
                    setMode("lineage");
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#6366f1",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Upstream
              </button>
              <button
                onClick={async () => {
                  try {
                    const down = await getGraphDownstream(projectId, selectedNode.id);
                    setHighlightIds(
                      new Set([selectedNode.id, ...down.nodes.map((n) => n.id)])
                    );
                    setMode("impact");
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#f59e0b",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Downstream
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedNode(null);
                setHighlightIds(new Set());
                setSelectedEdgesOut([]);
                setSelectedEdgesIn([]);
              }}
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "7px",
                background: "transparent",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: "#444",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
