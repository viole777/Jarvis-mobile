package com.viole.jarvis.claw

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/** A command leased from the authenticated Worker queue; execution is separate so UI can ask approval. */
data class QueuedClawCommand(
    val id: Long,
    val action: JSONObject,
    val serverMarkedApproved: Boolean
) {
    fun safePreview(): String = action.toString().take(1200)
}

/**
 * Android-side bridge between the authenticated Jarvis queue and the local Claw Use bridge.
 * The bridge token is never sent to Cloudflare. Call network methods off the UI thread.
 */
class ClawCommandExecutor(
    private val workerBaseUrl: String,
    private val jarvisAccessToken: String,
    private val deviceId: String,
    private val bridge: ClawUseClient,
    private val connectTimeoutMs: Int = 4_000,
    private val readTimeoutMs: Int = 8_000
) {
    init {
        require(workerBaseUrl.startsWith("https://")) { "Jarvis Worker must use HTTPS." }
        require(jarvisAccessToken.isNotBlank()) { "Jarvis access token is required." }
        require(deviceId.isNotBlank() && deviceId.length <= 80) { "Invalid device ID." }
    }

    /** Leases one command without executing it. The UI must obtain local confirmation first. */
    fun fetchNext(): QueuedClawCommand? {
        val path = "/v2/claw/commands/next?deviceId=" + java.net.URLEncoder.encode(deviceId, "UTF-8")
        val envelope = workerRequest("GET", path, null)
        val command = envelope.optJSONObject("command") ?: return null
        val id = command.optLong("id", -1L)
        val action = command.optJSONObject("action")
        if (id < 1L || action == null) return null
        return QueuedClawCommand(id, action, command.optBoolean("approved", false))
    }

    /** Executes only after the UI has explicitly confirmed this specific leased command. */
    fun executeApproved(command: QueuedClawCommand): JSONObject {
        if (!command.serverMarkedApproved) {
            reportResult(command.id, "failed", "Comando recusado: aprovação do servidor ausente.")
            throw IllegalStateException("O comando não está marcado como aprovado.")
        }
        return try {
            val result = bridge.act(command.action)
            reportResult(command.id, "completed", result.toString())
            result
        } catch (e: Exception) {
            try { reportResult(command.id, "failed", "Falha ao executar ação no Claw Use.") } catch (_: Exception) {}
            throw IllegalStateException("Falha ao executar ação no Claw Use.")
        }
    }

    /** Releases the lease as failed when the user rejects the action. */
    fun reject(command: QueuedClawCommand) {
        reportResult(command.id, "failed", "Ação recusada localmente pelo usuário.")
    }

    private fun reportResult(id: Long, status: String, summary: String) {
        val body = JSONObject().put("status", status).put("summary", summary.take(1000))
        workerRequest("POST", "/v2/claw/commands/" + id + "/result", body)
    }

    private fun workerRequest(method: String, path: String, body: JSONObject?): JSONObject {
        require(path.startsWith("/") && !path.startsWith("//")) { "Invalid endpoint path." }
        val connection = (URL(workerBaseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer " + jarvisAccessToken)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                connection.outputStream.use { it.write(body.toString().toByteArray(StandardCharsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("Jarvis Worker returned HTTP $status.")
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }
}
