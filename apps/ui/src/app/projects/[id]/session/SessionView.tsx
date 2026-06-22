"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  startSession,
  sendMessage,
  getPacks,
  type Skill,
  type CapabilityGap,
  type ContextLoaded,
  type MessageResponse,
  type ContextPack,
} from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  costUsd?: number;
}

interface SessionViewProps {
  projectId: string;
}

export function SessionView({ projectId }: SessionViewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextLoaded, setContextLoaded] = useState<ContextLoaded | null>(null);
  const [recommendedSkills, setRecommendedSkills] = useState<Skill[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilityGaps, setCapabilityGaps] = useState<CapabilityGap[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  // Pack selector state
  const [packs, setPacks] = useState<ContextPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packSelectorDone, setPackSelectorDone] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load packs for the selector
  useEffect(() => {
    let cancelled = false;
    async function loadPacks() {
      try {
        const result = await getPacks(projectId);
        if (!cancelled) setPacks(result);
      } catch {
        // If packs fail to load, skip the selector
        if (!cancelled) setPackSelectorDone(true);
      } finally {
        if (!cancelled) setPacksLoading(false);
      }
    }
    void loadPacks();
    return () => { cancelled = true; };
  }, [projectId]);

  async function handleStartSession() {
    setPackSelectorDone(true);
    setInitializing(true);
    try {
      const session = await startSession(
        projectId,
        undefined,
        selectedPackId ?? undefined,
      );
      setSessionId(session.sessionId);
      setContextLoaded(session.contextLoaded);
      setRecommendedSkills(session.recommendedSkills ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setInitializing(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || loading) return;

    let content = input.trim();
    if (activeSkill) {
      content = `${activeSkill.promptTemplate}\n\n${content}`;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(), // show original input, not prefixed template
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveSkill(null);
    setLoading(true);
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response: MessageResponse = await sendMessage(sessionId, content);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content,
        model: response.model,
        costUsd: response.costUsd,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setRecommendedSkills(response.recommendedSkills ?? []);
      setCapabilityGaps(response.capabilityGaps ?? []);
      setTotalCost(response.sessionTotalCostUsd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function activateSkill(skill: Skill) {
    setActiveSkill(skill);
    textareaRef.current?.focus();
  }

  const openTicketCount = contextLoaded?.openTickets ?? null;
  const chunkCount = contextLoaded?.relevantChunks ?? null;

  // Pack selector screen — shown before session starts
  if (!packSelectorDone) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "560px" }}>
          <Link
            href={`/projects/${projectId}`}
            style={{ fontSize: "12px", color: "#444", textDecoration: "none" }}
          >
            &larr; Back
          </Link>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 500,
              color: "#e8e8e8",
              marginTop: "20px",
              marginBottom: "6px",
            }}
          >
            Choose a context pack
          </h2>
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "24px" }}>
            Context packs pre-load relevant code chunks for your task. Skip to use general context.
          </p>

          {packsLoading ? (
            <p style={{ fontSize: "13px", color: "#444" }}>Loading packs&hellip;</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "28px" }}>
              <PackCard
                id={null}
                name="No pack — general context"
                description="Load context based on your first message."
                isBuiltIn={false}
                selected={selectedPackId === null}
                onSelect={() => setSelectedPackId(null)}
              />
              {packs.map((pack) => (
                <PackCard
                  key={pack.id}
                  id={pack.id}
                  name={pack.name}
                  description={pack.description}
                  isBuiltIn={pack.isBuiltIn}
                  selected={selectedPackId === pack.id}
                  onSelect={() => setSelectedPackId(pack.id)}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => void handleStartSession()}
            disabled={packsLoading}
            style={{
              background: packsLoading ? "#1a1a1a" : "#e8e8e8",
              color: packsLoading ? "#333" : "#0a0a0a",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: packsLoading ? "not-allowed" : "pointer",
            }}
          >
            Start session
          </button>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#444",
          fontSize: "13px",
        }}
      >
        Loading session…
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid #1e1e1e",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href={`/projects/${projectId}`}
            style={{
              fontSize: "12px",
              color: "#444",
              textDecoration: "none",
            }}
          >
            ← {contextLoaded?.project ?? projectId}
          </Link>
          {sessionId && (
            <span
              style={{
                fontSize: "11px",
                color: "#333",
                fontFamily: "monospace",
              }}
            >
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
        {totalCost > 0 && (
          <span style={{ fontSize: "12px", color: "#444" }}>
            Session: ${totalCost.toFixed(4)}
          </span>
        )}
      </header>

      {/* Context banner */}
      {contextLoaded && (
        <div
          style={{
            padding: "8px 20px",
            background: "#111",
            borderBottom: "1px solid #1a1a1a",
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: "12px", color: "#555" }}>
            Loaded:{" "}
            <span style={{ color: "#888" }}>
              {contextLoaded.project ?? "unknown project"}
            </span>
            {selectedPackId !== null && (() => {
              const pack = packs.find((p) => p.id === selectedPackId);
              return pack ? (
                <>{" · "}<span style={{ color: "#666" }}>{pack.name}</span></>
              ) : null;
            })()}
            {openTicketCount !== null && (
              <>
                {" · "}
                <span style={{ color: "#888" }}>{openTicketCount} tickets</span>
              </>
            )}
            {chunkCount !== null && (
              <>
                {" · "}
                <span style={{ color: "#888" }}>{chunkCount} code chunks</span>
              </>
            )}
            {contextLoaded.lastSessionSummary && (
              <>
                {" · "}
                <span style={{ color: "#555" }}>prior session loaded</span>
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "10px 20px",
            background: "#1a0a0a",
            borderBottom: "1px solid #3a1a1a",
            color: "#f87171",
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Main content: messages + skills sidebar */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Messages pane */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "24px 0",
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2a2a2a",
                fontSize: "14px",
              }}
            >
              Start a conversation
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {loading && (
              <div
                style={{
                  padding: "20px 24px",
                  borderTop: "1px solid #141414",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#444",
                    fontSize: "13px",
                  }}
                >
                  <span className="mono" style={{ letterSpacing: "0.1em" }}>
                    ···
                  </span>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Right sidebar: skills + capability gaps */}
        {(recommendedSkills.length > 0 || capabilityGaps.length > 0) && (
          <div
            style={{
              width: "240px",
              borderLeft: "1px solid #1a1a1a",
              padding: "20px 16px",
              overflowY: "auto",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {recommendedSkills.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#444",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "14px",
                  }}
                >
                  Suggested skills
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recommendedSkills.slice(0, 3).map((skill) => (
                    <SkillChip
                      key={skill.id}
                      skill={skill}
                      active={activeSkill?.id === skill.id}
                      hovered={hoveredSkill === skill.id}
                      onActivate={() => activateSkill(skill)}
                      onHoverChange={(h) => setHoveredSkill(h ? skill.id : null)}
                    />
                  ))}
                </div>
              </div>
            )}

            {capabilityGaps.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#444",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "14px",
                  }}
                >
                  Expertise gaps
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {capabilityGaps.map((gap) => (
                    <GapChip key={gap.id} gap={gap} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: "1px solid #1a1a1a",
          padding: "16px 20px",
          flexShrink: 0,
          background: "#0a0a0a",
        }}
      >
        {activeSkill && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "#888",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "4px",
                padding: "3px 8px",
              }}
            >
              {activeSkill.name}
            </span>
            <button
              onClick={() => setActiveSkill(null)}
              style={{
                background: "none",
                border: "none",
                color: "#444",
                cursor: "pointer",
                fontSize: "12px",
                padding: "0",
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={loading || !sessionId}
            style={{
              flex: 1,
              background: "#141414",
              border: "1px solid #252525",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#e8e8e8",
              fontSize: "14px",
              resize: "none",
              outline: "none",
              lineHeight: "1.5",
              fontFamily: "system-ui, sans-serif",
              minHeight: "42px",
              maxHeight: "200px",
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={loading || !input.trim() || !sessionId}
            style={{
              background: loading || !input.trim() ? "#1a1a1a" : "#e8e8e8",
              color: loading || !input.trim() ? "#333" : "#0a0a0a",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 500,
              cursor:
                loading || !input.trim() || !sessionId
                  ? "not-allowed"
                  : "pointer",
              flexShrink: 0,
              height: "42px",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function PackCard({
  id,
  name,
  description,
  isBuiltIn,
  selected,
  onSelect,
}: {
  id: string | null;
  name: string;
  description: string;
  isBuiltIn: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        background: selected ? "#141414" : "transparent",
        border: `1px solid ${selected ? "#2a2a2a" : "#1a1a1a"}`,
        borderRadius: "8px",
        padding: "12px 14px",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "all 0.1s",
      }}
    >
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          border: `2px solid ${selected ? "#888" : "#333"}`,
          flexShrink: 0,
          marginTop: "2px",
          background: selected ? "#888" : "transparent",
          boxSizing: "border-box",
        }}
      />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: selected ? "#e8e8e8" : "#888" }}>
            {name}
          </span>
          {id !== null && isBuiltIn && (
            <span
              style={{
                fontSize: "10px",
                color: "#444",
                background: "#111",
                border: "1px solid #1e1e1e",
                borderRadius: "3px",
                padding: "1px 5px",
              }}
            >
              built-in
            </span>
          )}
        </div>
        <p style={{ fontSize: "12px", color: "#555", margin: 0, lineHeight: "1.4" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        padding: "16px 24px",
        borderTop: "1px solid #111",
        background: isUser ? "transparent" : "#0d0d0d",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: isUser ? "#666" : "#888",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {isUser ? "You" : "DevOS"}
          </span>
          {!isUser && message.model && (
            <span style={{ fontSize: "11px", color: "#333" }}>
              {message.model}
              {message.costUsd !== undefined && message.costUsd > 0 && (
                <> · ${message.costUsd.toFixed(4)}</>
              )}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "14px",
            color: "#d0d0d0",
            lineHeight: "1.65",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

function GapChip({ gap }: { gap: CapabilityGap }) {
  const [hovered, setHovered] = useState(false);
  const color = SEVERITY_COLORS[gap.severity] ?? "#6b7280";

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#141414",
          border: "1px solid #222",
          borderRadius: "6px",
          padding: "8px 10px",
          cursor: "default",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "12px",
            color: "#888",
            textTransform: "capitalize",
          }}
        >
          {gap.domain}
        </span>
      </div>

      {hovered && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            top: "0",
            width: "220px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "12px",
            zIndex: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {gap.severity}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#e8e8e8",
                textTransform: "capitalize",
              }}
            >
              {gap.domain}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#888", lineHeight: "1.5", marginBottom: "8px" }}>
            {gap.description}
          </p>
          <p style={{ fontSize: "11px", color: "#555", lineHeight: "1.5" }}>
            Risk: {gap.exampleRisk}
          </p>
        </div>
      )}
    </div>
  );
}

function SkillChip({
  skill,
  active,
  hovered,
  onActivate,
  onHoverChange,
}: {
  skill: Skill;
  active: boolean;
  hovered: boolean;
  onActivate: () => void;
  onHoverChange: (h: boolean) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onActivate}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        style={{
          width: "100%",
          background: active ? "#1e1e1e" : "#141414",
          border: `1px solid ${active ? "#3a3a3a" : "#222"}`,
          borderRadius: "6px",
          padding: "8px 10px",
          color: active ? "#e8e8e8" : "#888",
          fontSize: "12px",
          fontWeight: active ? 500 : 400,
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.1s",
        }}
      >
        {skill.name}
        <span
          style={{
            display: "inline-block",
            marginLeft: "6px",
            fontSize: "10px",
            color: "#3a3a3a",
            background: "#1a1a1a",
            borderRadius: "3px",
            padding: "1px 4px",
          }}
        >
          {skill.requiredModelCapability}
        </span>
      </button>

      {hovered && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            top: "0",
            width: "220px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "12px",
            zIndex: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#e8e8e8",
              marginBottom: "6px",
            }}
          >
            {skill.name}
          </p>
          <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.5" }}>
            {skill.description}
          </p>
          {skill.triggerKeywords.length > 0 && (
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
              }}
            >
              {skill.triggerKeywords.slice(0, 5).map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: "10px",
                    color: "#444",
                    background: "#111",
                    borderRadius: "3px",
                    padding: "2px 5px",
                    border: "1px solid #1e1e1e",
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
