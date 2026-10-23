package com.viole.jarvis.claw

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * Executes one authenticated Jarvis Cloud queue item on-device.
 *
 * The Jarvis access token authenticates to the Worker. The Claw Use bridge
 * token is used only for the direct device-to-bridge request and is never
 * included in any Cloudflare request.
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

    /** Polls once; returns false when no command is queued. */
    fun runOnce(): Boolean {
        val path = "/v2/claw/commands/next?deviceId=" + java.net.URLEncoder.encode(deviceId, "UTF-8")
        val envelope = workerRequest("GET", path, null)
        val command = envelope.optJSONObject("command") ?: return false
        val id = command.optLong("id", -1L)
        val action = command.optJSONObject("action")
        if (id < 1L || action == null) return false

        try {
            // Require explicit approval in the queue payload before any device-changing action.
            if (!command.optBoolean("approved", false)) {
                postResult(id, "failed", "Comando recusado: aprovação explícita ausente.")
                return true
            }
            val result = bridge.act(action)
            postResult(id, "completed", result.toString())
        } catch (_: Exception) {
            // Do not forward exception text, which could contain private device details.
            postResult(id, "failed", "Falha ao executar ação no Claw Use.")
        }
        return true
    }

    private fun postResult(id: Long, status: String, summary: String) {
        val body = JSONObject()
            .put("status", status)
            .put("summary", summary.take(1000))
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
