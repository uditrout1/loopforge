"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  startSession,
  sendMessage,
  type Skill,
  type ContextLoaded,
  type MessageResponse,
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
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const session = await startSession(projectId);
        if (cancelled) return;
        setSessionId(session.sessionId);
        setContextLoaded(session.contextLoaded);
        setRecommendedSkills(session.recommendedSkills ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to start session");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [projectId]);

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

  const openTicketCount = Array.isArray(contextLoaded?.openTickets)
    ? contextLoaded.openTickets.length
    : null;
  const chunkCount = Array.isArray(contextLoaded?.relevantChunks)
    ? contextLoaded.relevantChunks.length
    : null;

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
            ← {contextLoaded?.project?.name ?? projectId}
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
              {contextLoaded.project?.name ?? "unknown project"}
            </span>
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

        {/* Skills sidebar */}
        {recommendedSkills.length > 0 && (
          <div
            style={{
              width: "240px",
              borderLeft: "1px solid #1a1a1a",
              padding: "20px 16px",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
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
