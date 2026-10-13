const MAX_OUTPUT = 12_000;
const REPO = "viole777/Jarvis-mobile";

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
  ] }
];

async function githubJson(url) {
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "Jarvis-Agent/1.0", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("GitHub respondeu HTTP " + response.status + ". Verifique o limite da API ou o caminho.");
  return response.json();
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
