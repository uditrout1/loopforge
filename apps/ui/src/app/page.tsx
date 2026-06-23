import Link from "next/link";
import { getProjects } from "@/lib/api";
import type { Project } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    projects = await getProjects();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load projects";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "48px 32px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "48px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f0f0f0",
            }}
          >
            LoopForge
          </h1>
          <p style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>
            Product Engineering Intelligence
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href="/settings"
            style={{
              background: "transparent",
              color: "#555",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            ⚙ Settings
          </Link>
          <Link
            href="/projects/new"
            style={{
              background: "#1a1a1a",
              color: "#e8e8e8",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
              border: "1px solid #2a2a2a",
            }}
          >
            Connect repo
          </Link>
          <Link
            href="/projects/new?mode=vibe"
            style={{
              background: "#f0f0f0",
              color: "#0a0a0a",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Start from scratch →
          </Link>
        </div>
      </header>

      {error && (
        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: "8px",
            padding: "16px",
            color: "#f87171",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          {error}
        </div>
      )}

      {!error && projects.length === 0 && (
        <div
          style={{
            border: "1px dashed #2a2a2a",
            borderRadius: "12px",
            padding: "64px 32px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#444", fontSize: "14px" }}>No projects yet.</p>
          <p style={{ color: "#333", fontSize: "13px", marginTop: "8px" }}>
            Connect an existing repo or start from scratch.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <Link
              href="/projects/new"
              style={{
                display: "inline-block",
                background: "#1a1a1a",
                color: "#e8e8e8",
                padding: "10px 20px",
                borderRadius: "6px",
                fontSize: "13px",
                textDecoration: "none",
                border: "1px solid #2a2a2a",
              }}
            >
              Connect a repo
            </Link>
            <Link
              href="/projects/new?mode=vibe"
              style={{
                display: "inline-block",
                background: "#f0f0f0",
                color: "#0a0a0a",
                padding: "10px 20px",
                borderRadius: "6px",
                fontSize: "13px",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Start from scratch →
            </Link>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#555",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "4px",
            }}
          >
            Projects ({projects.length})
          </p>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 500,
            color: "#f0f0f0",
            marginBottom: "4px",
          }}
        >
          {project.name}
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "#555",
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.repoPath}
        </p>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <Link
          href={`/projects/${project.id}`}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#aaa",
            textDecoration: "none",
            border: "1px solid #2a2a2a",
            background: "#111",
          }}
        >
          Dashboard
        </Link>
        <Link
          href={`/projects/${project.id}/session`}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#0a0a0a",
            textDecoration: "none",
            background: "#e8e8e8",
            fontWeight: 500,
          }}
        >
          New session
        </Link>
      </div>
    </div>
  );
}
