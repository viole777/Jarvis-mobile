const MAX_OUTPUT = 12_000;
const REPO = "viole777/Jarvis-mobile";
const pendingGitHubChanges = new Map();

function jsonResult(value) {
  return JSON.stringify(value).slice(0, MAX_OUTPUT);
}

export const JARVIS_TOOLS = [
  { name: "get_jarvis_status", description: "Check Jarvis backend configuration and available skill names. Does not reveal secrets.", parameters: [] },
  { name: "list_skills", description: "List installed Jarvis skills and short descriptions.", parameters: [] },
  { name: "read_own_repo_file", description: "Read a text file from the public viole777/Jarvis-mobile GitHub repository. Use only paths within this repository.", parameters: [
    { name: "path", type: "string", required: true, description: "Repository-relative file path, e.g. server/package.json" }
  ] },
  { name: "list_own_repo_directory", description: "List files and directories in the public viole777/Jarvis-mobile GitHub repository.", parameters: [
    { name: "path", type: "string", required: false, description: "Repository-relative directory path; empty for repository root" }
  ] },
  { name: "propose_github_file_change", description: "Prepare a code/document change on the Jarvis repository. This only stages a proposal; a human must explicitly approve before a branch, commit, or pull request is created. Never include secrets.", parameters: [
    { name: "path", type: "string", required: true, description: "Repository-relative path of the file to create or replace" },
    { name: "content", type: "string", required: true, description: "Complete new file contents, maximum 80 KB" },
    { name: "message", type: "string", required: true, description: "Short commit and pull request title" }
  ] }
];

async function githubJson(url) {
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "Jarvis-Agent/1.0", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("GitHub respondeu HTTP " + response.status + ". Verifique o limite da API ou o caminho.");
  return response.json();
}

async function githubRequest(url, method, payload) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error("A edição do GitHub está desativada: configure GITHUB_TOKEN como segredo do servidor com permissão de conteúdo e pull requests."), { statusCode: 503 });
  const response = await fetch(url, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "User-Agent": "Jarvis-Agent/1.0",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error("GitHub respondeu HTTP " + response.status + ": " + String(data.message || "falha na operação").slice(0, 300)), { statusCode: response.status });
  return data;
}

export function listPendingGitHubChanges() {
  const now = Date.now();
  for (const [id, item] of pendingGitHubChanges) if (item.expiresAt <= now) pendingGitHubChanges.delete(id);
  return [...pendingGitHubChanges.entries()].map(([id, item]) => ({ id, path: item.path, message: item.message, createdAt: item.createdAt, expiresAt: item.expiresAt }));
}

export async function confirmGitHubChange(id, approve) {
  const item = pendingGitHubChanges.get(id);
  if (!item || item.expiresAt <= Date.now()) {
    pendingGitHubChanges.delete(id);
    throw Object.assign(new Error("A proposta não existe ou expirou."), { statusCode: 404 });
  }
  pendingGitHubChanges.delete(id);
  if (!approve) return { ok: true, approved: false, message: "Alteração cancelada; nenhum arquivo foi modificado." };
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error("Configure GITHUB_TOKEN no servidor antes de aprovar alterações do GitHub."), { statusCode: 503 });
  const api = "https://api.github.com/repos/" + REPO;
  const repoInfo = await githubJson(api);
  const base = repoInfo.default_branch || "main";
  const baseRef = await githubJson(api + "/git/ref/heads/" + encodeURIComponent(base));
  const branch = "jarvis/task-" + Date.now().toString(36) + "-" + id.slice(0, 8);
  await githubRequest(api + "/git/refs", "POST", { ref: "refs/heads/" + branch, sha: baseRef.object.sha });
  let existingSha;
  try {
    const existing = await githubJson(api + "/contents/" + item.path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch));
    if (existing.type === "file") existingSha = existing.sha;
  } catch {}
  const payload = { message: item.message, content: Buffer.from(item.content, "utf8").toString("base64"), branch };
  if (existingSha) payload.sha = existingSha;
  await githubRequest(api + "/contents/" + item.path.split("/").map(encodeURIComponent).join("/"), "PUT", payload);
  let pullRequest = null;
  try {
    pullRequest = await githubRequest(api + "/pulls", "POST", {
      title: item.message.slice(0, 240),
      head: branch,
      base,
      body: "Proposta criada pelo Jarvis após aprovação explícita do usuário. Revise as alterações e os testes antes de mesclar.\n\nArquivo: `" + item.path + "`."
    });
  } catch (error) {
    return { ok: true, branch, file: item.path, compareUrl: "https://github.com/" + REPO + "/compare/" + encodeURIComponent(base) + "..." + encodeURIComponent(branch), pullRequestError: String(error.message).slice(0, 300) };
  }
  return { ok: true, branch, file: item.path, pullRequestUrl: pullRequest.html_url, pullRequestNumber: pullRequest.number };
}

export async function executeJarvisTool(name, args = {}, { aisa, listSkills } = {}) {
  try {
    if (name === "get_jarvis_status") {
      return jsonResult({
        service: "jarvis-server",
        modelConfigured: Boolean(aisa?.isConfigured?.()),
        primaryModel: aisa?.model || null,
        fallbackModelsConfigured: Array.isArray(aisa?.fallbacks) ? aisa.fallbacks.length : 0,
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
    if (name === "propose_github_file_change") {
      const filePath = typeof args.path === "string" ? args.path.trim() : "";
      const content = typeof args.content === "string" ? args.content : "";
      const message = typeof args.message === "string" ? args.message.trim() : "";
      if (!filePath || filePath.startsWith("/") || filePath.split("/").some((part) => part === "..") || filePath.includes("\\\\") || filePath.length > 240) return jsonResult({ error: "Invalid repository-relative path." });
      if (/(^|\\/)(\\.env(\\.|$)|secrets?(\\.|$)|credentials?(\\.|$))/i.test(filePath) || /(^|\\/)\\.github\\/workflows\\//i.test(filePath)) return jsonResult({ error: "This path is blocked for automated edits; review and make the change manually." });
      if (!content || Buffer.byteLength(content, "utf8") > 80_000 || !message || message.length > 240) return jsonResult({ error: "Content is required (maximum 80 KB) and message must be 1-240 characters." });
      const id = crypto.randomUUID();
      const now = Date.now();
      pendingGitHubChanges.set(id, { path: filePath, content, message, createdAt: new Date(now).toISOString(), expiresAt: now + 10 * 60 * 1000 });
      return jsonResult({ confirmationRequired: true, actionId: id, path: filePath, message, expiresInSeconds: 600, notice: "No GitHub change has been made. Ask the user to review and explicitly approve this proposal." });
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
    return jsonResult({ error: "Tool not allowed: " + String(name).slice(0, 100) });
  } catch (error) {
    return jsonResult({ error: String(error?.message || "Tool failed").slice(0, 500) });
  }
}
