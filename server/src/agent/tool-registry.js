const MAX_OUTPUT = 12_000;
const REPO = process.env.JARVIS_GITHUB_REPOSITORY || "viole777/Jarvis-mobile";
const DEFAULT_BRANCH = process.env.JARVIS_GITHUB_BASE_BRANCH || "main";
const ALLOWED_WRITE_PREFIXES = ["server/src/", "server/public/", "server/skills/", "docs/"];
const BLOCKED_WRITE_PATHS = [
  /^\.github\//i, /(^|\/)\.env(\.|$)/i, /(^|\/)package(-lock)?\.json$/i,
  /(^|\/)pnpm-lock\.yaml$/i, /(^|\/)yarn\.lock$/i, /(^|\/)bun\.lockb?$/i,
  /(^|\/)secrets?\//i, /(^|\/)credentials?\//i
];

function jsonResult(value) {
  return JSON.stringify(value).slice(0, MAX_OUTPUT);
}

function githubHeaders() {
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "Jarvis-Agent/1.0", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  return headers;
}

async function githubJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}), ...(options.body ? { "Content-Type": "application/json" } : {}) },
    signal: options.signal || AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GitHub respondeu HTTP " + response.status + ". Verifique permissões, limites da API ou configuração.");
    error.statusCode = response.status === 404 ? 404 : response.status === 401 || response.status === 403 ? 503 : 502;
    throw error;
  }
  return data;
}

function safeWritePath(value) {
  if (typeof value !== "string") return null;
  const filePath = value.trim().replace(/^\.\//, "");
  if (!filePath || filePath.length > 180 || filePath.startsWith("/") || filePath.includes("\\") ||
      filePath.split("/").some((part) => !part || part === "." || part === "..") ||
      !ALLOWED_WRITE_PREFIXES.some((prefix) => filePath.startsWith(prefix)) ||
      BLOCKED_WRITE_PATHS.some((pattern) => pattern.test(filePath))) return null;
  return filePath;
}

function looksLikeSecret(content) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-proj-|sk-live-|gh[pousr]_[A-Za-z0-9_]{20,})|(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{12,}["']/i.test(content);
}

export const JARVIS_TOOLS = [
  { name: "get_jarvis_status", description: "Check Jarvis backend configuration and available skill names. Does not reveal secrets.", parameters: [] },
  { name: "list_skills", description: "List installed Jarvis skills and short descriptions.", parameters: [] },
  { name: "read_own_repo_file", description: "Read a text file from the public Jarvis GitHub repository.", parameters: [
    { name: "path", type: "string", required: true, description: "Repository-relative file path, e.g. server/package.json" }
  ] },
  { name: "list_own_repo_directory", description: "List files and directories in the public Jarvis GitHub repository.", parameters: [
    { name: "path", type: "string", required: false, description: "Repository-relative directory path; empty for repository root" }
  ] },
  { name: "propose_github_file_change", description: "When GitHub writing is explicitly enabled, create a new branch, change one allowed text file, and open a pull request. Never merges or deploys. The result contains the PR URL; report it and wait for human review.", parameters: [
    { name: "path", type: "string", required: true, description: "Allowed repository-relative file path under server/src/, server/public/, server/skills/, or docs/" },
    { name: "content", type: "string", required: true, description: "Complete new file content, max 30 KB. Never include secrets." },
    { name: "summary", type: "string", required: true, description: "Short human-readable purpose for the pull request, max 120 characters." }
  ] }
];

export async function executeJarvisTool(name, args = {}, { aisa, listSkills } = {}) {
  try {
    if (name === "get_jarvis_status") {
      return jsonResult({
        service: "jarvis-server",
        modelConfigured: Boolean(aisa?.isConfigured?.()),
        primaryModel: aisa?.model || null,
        fallbackModelsConfigured: Array.isArray(aisa?.fallbacks) ? aisa.fallbacks.length : 0,
        githubWriteEnabled: process.env.JARVIS_GITHUB_WRITE_ENABLED === "true" && Boolean(process.env.GITHUB_TOKEN),
        installedSkills: listSkills().map((skill) => skill.id)
      });
    }
    if (name === "list_skills") return jsonResult(listSkills());
    if (name === "read_own_repo_file") {
      const filePath = typeof args.path === "string" ? args.path.trim() : "";
      if (!filePath || filePath.startsWith("/") || filePath.split("/").some((part) => part === "..") || filePath.includes("\\") || filePath.length > 240) {
        return jsonResult({ error: "Invalid repository-relative path." });
      }
      const data = await githubJson("https://api.github.com/repos/" + REPO + "/contents/" + filePath.split("/").map(encodeURIComponent).join("/"));
      if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string") return jsonResult({ error: "The requested path is not a readable file." });
      const decoded = Buffer.from(data.content, "base64").toString("utf8");
      return jsonResult({ path: filePath, content: decoded.slice(0, MAX_OUTPUT), truncated: decoded.length > MAX_OUTPUT, url: data.html_url });
    }
    if (name === "list_own_repo_directory") {
      const dirPath = typeof args.path === "string" ? args.path.trim() : "";
      if (dirPath.startsWith("/") || dirPath.split("/").some((part) => part === "..") || dirPath.includes("\\") || dirPath.length > 240) {
        return jsonResult({ error: "Invalid repository-relative path." });
      }
      const suffix = dirPath ? "/" + dirPath.split("/").map(encodeURIComponent).join("/") : "";
      const data = await githubJson("https://api.github.com/repos/" + REPO + "/contents" + suffix);
      if (!Array.isArray(data)) return jsonResult({ error: "The requested path is not a directory." });
      return jsonResult(data.slice(0, 100).map((item) => ({ name: item.name, path: item.path, type: item.type, url: item.html_url })));
    }
    if (name === "propose_github_file_change") {
      if (process.env.JARVIS_GITHUB_WRITE_ENABLED !== "true") return jsonResult({ error: "GitHub write capability is disabled. Set JARVIS_GITHUB_WRITE_ENABLED=true after configuring a least-privilege GITHUB_TOKEN." });
      if (!process.env.GITHUB_TOKEN) return jsonResult({ error: "GITHUB_TOKEN is not configured in the server environment." });
      const filePath = safeWritePath(args.path);
      const content = typeof args.content === "string" ? args.content : "";
      const summary = typeof args.summary === "string" ? args.summary.trim().slice(0, 120) : "";
      if (!filePath) return jsonResult({ error: "Path blocked by Jarvis write policy. Only server source/UI, skills, and docs paths are allowed." });
      if (!content || Buffer.byteLength(content, "utf8") > 30_000) return jsonResult({ error: "File content must be between 1 byte and 30 KB." });
      if (looksLikeSecret(content)) return jsonResult({ error: "Change blocked because its content resembles a credential or private key. Store secrets in the host secret manager." });
      if (!summary) return jsonResult({ error: "A short change summary is required." });

      const branch = "jarvis/agent-" + Date.now().toString(36);
      const api = "https://api.github.com/repos/" + REPO;
      const baseRef = await githubJson(api + "/git/ref/heads/" + encodeURIComponent(DEFAULT_BRANCH));
      await githubJson(api + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branch, sha: baseRef.object.sha }) });

      let existingSha;
      try {
        const existing = await githubJson(api + "/contents/" + filePath.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch));
        if (existing.type !== "file" || typeof existing.sha !== "string") return jsonResult({ error: "Target path is not a regular text file." });
        existingSha = existing.sha;
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      }

      const commitBody = { message: "Jarvis proposal: " + summary, content: Buffer.from(content, "utf8").toString("base64"), branch };
      if (existingSha) commitBody.sha = existingSha;
      await githubJson(api + "/contents/" + filePath.split("/").map(encodeURIComponent).join("/"), { method: "PUT", body: JSON.stringify(commitBody) });
      const pr = await githubJson(api + "/pulls", {
        method: "POST",
        body: JSON.stringify({
          title: ("Jarvis: " + summary).slice(0, 250),
          body: "## Jarvis change proposal\n\n" + summary + "\n\n- File: `" + filePath + "`\n- Created on an isolated branch by Jarvis\n- **Not merged or deployed**; human review and CI are required.",
          head: branch,
          base: DEFAULT_BRANCH,
          draft: true
        })
      });
      return jsonResult({ ok: true, path: filePath, branch, pullRequest: pr.html_url, number: pr.number, merged: false, deployed: false, message: "Draft pull request created; review CI and diff before merging." });
    }
    return jsonResult({ error: "Tool not allowed: " + String(name).slice(0, 100) });
  } catch (error) {
    return jsonResult({ error: String(error?.message || "Tool failed").slice(0, 500) });
  }
}
