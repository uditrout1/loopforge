"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  getFileTree,
  getFileContent,
  saveFileContent,
  type FileTreeEntry,
} from "@/lib/api";

// Monaco must be loaded client-side only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Language detection ───────────────────────────────────────────────────────

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", go: "go", rs: "rust", rb: "ruby",
  java: "java", kt: "kotlin", swift: "swift",
  md: "markdown", mdx: "markdown",
  json: "json", yaml: "yaml", yml: "yaml", toml: "ini",
  html: "html", css: "css", scss: "scss",
  sh: "shell", sql: "sql", graphql: "graphql",
};

function langForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? "plaintext";
}

// ─── File tree component ──────────────────────────────────────────────────────

function TreeNode({
  entry,
  depth,
  selectedPath,
  onSelect,
}: {
  entry: FileTreeEntry;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (entry.type === "dir") {
    return (
      <div>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            padding: `3px 8px 3px ${8 + depth * 14}px`,
            fontSize: "12px",
            color: "#666",
            cursor: "pointer",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "10px" }}>{open ? "▾" : "▸"}</span>
          {entry.name}
        </div>
        {open &&
          entry.children?.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const isSelected = entry.path === selectedPath;
  return (
    <div
      onClick={() => onSelect(entry.path)}
      style={{
        padding: `3px 8px 3px ${8 + depth * 14}px`,
        fontSize: "12px",
        color: isSelected ? "#f0f0f0" : "#888",
        background: isSelected ? "#1e1e1e" : "transparent",
        cursor: "pointer",
        userSelect: "none",
        borderLeft: isSelected ? "2px solid #6366f1" : "2px solid transparent",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {entry.name}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [projectId, setProjectId] = useState("");
  const [tree, setTree] = useState<FileTreeEntry[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const editorRef = useRef<unknown>(null);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  // Load file tree
  useEffect(() => {
    if (!projectId) return;
    setTreeLoading(true);
    getFileTree(projectId)
      .then(({ tree: t, repoPath: rp }) => {
        setTree(t);
        setRepoPath(rp);
      })
      .catch(console.error)
      .finally(() => setTreeLoading(false));
  }, [projectId]);

  // Load file content when selection changes
  const handleSelect = useCallback(
    async (path: string) => {
      if (path === selectedPath) return;
      setSelectedPath(path);
      setLoading(true);
      try {
        const { content: c } = await getFileContent(projectId, path);
        setContent(c);
        setSavedContent(c);
      } catch (e) {
        setContent(`// Error loading file: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [projectId, selectedPath]
  );

  // Save
  const handleSave = useCallback(async () => {
    if (!selectedPath || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveFileContent(projectId, selectedPath, content);
      setSavedContent(content);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (e) {
      setSaveMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [projectId, selectedPath, content, saving]);

  // Cmd+S / Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const isDirty = content !== savedContent;
  const language = selectedPath ? langForPath(selectedPath) : "plaintext";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Topbar */}
      <div
        style={{
          height: "40px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <Link
          href={`/projects/${projectId}`}
          style={{ color: "#555", textDecoration: "none", fontSize: "12px" }}
        >
          ← Back
        </Link>
        <span style={{ color: "#333" }}>|</span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0" }}>
          Editor
        </span>
        {selectedPath && (
          <>
            <span style={{ color: "#333" }}>·</span>
            <span
              style={{
                fontSize: "12px",
                color: isDirty ? "#f59e0b" : "#555",
                fontFamily: "monospace",
              }}
            >
              {selectedPath}
              {isDirty ? " ●" : ""}
            </span>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          {saveMsg && (
            <span
              style={{
                fontSize: "11px",
                color: saveMsg.startsWith("Error") ? "#f87171" : "#22c55e",
              }}
            >
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={!selectedPath || saving || !isDirty}
            style={{
              padding: "5px 14px",
              background: isDirty ? "#6366f1" : "#1a1a1a",
              color: isDirty ? "#fff" : "#444",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: selectedPath && isDirty ? "pointer" : "default",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* File tree */}
        <div
          style={{
            width: "220px",
            flexShrink: 0,
            borderRight: "1px solid #1a1a1a",
            overflowY: "auto",
            paddingTop: "8px",
          }}
        >
          {treeLoading ? (
            <p style={{ color: "#333", fontSize: "12px", padding: "12px" }}>
              Loading…
            </p>
          ) : tree.length === 0 ? (
            <p style={{ color: "#333", fontSize: "12px", padding: "12px" }}>
              No files found
            </p>
          ) : (
            tree.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                selectedPath={selectedPath}
                onSelect={(p) => void handleSelect(p)}
              />
            ))
          )}
          {repoPath && (
            <p
              style={{
                fontSize: "10px",
                color: "#2a2a2a",
                padding: "12px 8px 8px",
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {repoPath}
            </p>
          )}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {!selectedPath ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#333",
                fontSize: "13px",
              }}
            >
              Select a file to edit
            </div>
          ) : loading ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#333",
                fontSize: "13px",
              }}
            >
              Loading…
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              language={language}
              value={content}
              theme="vs-dark"
              onChange={(val) => setContent(val ?? "")}
              onMount={(editor) => { editorRef.current = editor }}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                lineNumbers: "on",
                renderWhitespace: "none",
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
