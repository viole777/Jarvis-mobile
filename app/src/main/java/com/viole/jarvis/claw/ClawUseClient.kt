package com.viole.jarvis.claw

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * Minimal authenticated client for the Claw Use Android HTTP bridge.
 *
 * Call from a background thread (never the Android main/UI thread).
 * Keep the bridge token in private app storage; never send it to the Jarvis
 * Cloudflare Worker or include it in logs.
 *
 * This client deliberately exposes only the screen-read and unified-action
 * endpoints. A caller must still obtain explicit user consent before actions
 * that change another app or send data.
 */
class ClawUseClient(
    private val baseUrl: String,
    private val bridgeToken: String,
    private val connectTimeoutMs: Int = 4_000,
    private val readTimeoutMs: Int = 8_000
) {
    init {
        require(baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
            "Bridge URL must use HTTP or HTTPS."
        }
        require(bridgeToken.isNotBlank()) { "Claw Use bridge token is required." }
        require(connectTimeoutMs in 1_000..15_000)
        require(readTimeoutMs in 1_000..30_000)
    }

    /** Reads the semantic accessibility tree from GET /screen. */
    fun readScreen(compact: Boolean = true): JSONObject {
        val suffix = if (compact) "/screen?compact=true" else "/screen"
        return request("GET", suffix, null)
    }

    /**
     * Sends one action to POST /act.
     *
     * Only documented, structured Claw Use action fields are accepted.
     * This is intentionally not a generic URL/request proxy.
     */
    fun act(action: JSONObject): JSONObject {
        require(action.length() in 1..5) { "Provide between 1 and 5 action fields." }
        val allowed = setOf(
            "click", "tap", "type", "swipe", "scroll",
            "back", "home", "recents", "launch", "longpress"
        )
        val keys = action.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            require(key in allowed) { "Unsupported Claw Use action: $key" }
        }
        return request("POST", "/act", action)
    }

    /** Verifies connectivity without exposing the bridge token. */
    fun ping(): JSONObject = request("GET", "/ping", null, authenticated = false)

    private fun request(
        method: String,
        path: String,
        body: JSONObject?,
        authenticated: Boolean = true
    ): JSONObject {
        val root = baseUrl.trimEnd('/')
        require(path.startsWith("/") && !path.startsWith("//")) { "Invalid endpoint path." }
        val connection = (URL(root + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
            setRequestProperty("Accept", "application/json")
            if (authenticated) setRequestProperty("X-Bridge-Token", bridgeToken)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toString().toByteArray(StandardCharsets.UTF_8))
                }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                // Do not include headers, URL query values, or credentials in the exception.
                throw IllegalStateException("Claw Use bridge returned HTTP $status.")
            }
            return if (text.isBlank()) JSONObject().put("ok", true) else JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }
}
