package com.viole.jarvis.agent

import com.viole.jarvis.tools.ToolSchema
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HttpModelClient(
    private val baseUrl: String,
    private val authToken: String
) : ModelClient {

    override suspend fun generate(
        messages: List<AgentMessage>,
        tools: List<ToolSchema>
    ): ModelResponse {
        val payload = JSONObject()
            .put("messages", JSONArray().apply { messages.forEach { put(it.toJson()) } })
            .put("tools", JSONArray().apply { tools.forEach { put(it.toJson()) } })

        val connection = (URL(baseUrl.trimEnd('/') + "/v1/agent").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer " + authToken)
        }

        connection.outputStream.use {
            it.write(payload.toString().toByteArray(Charsets.UTF_8))
        }

        val responseCode = connection.responseCode
        val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
        val responseText = stream.bufferedReader().use { it.readText() }

        if (responseCode !in 200..299) {
            throw IllegalStateException("Backend HTTP " + responseCode + ": " + responseText)
        }

        val response = JSONObject(responseText)
        val calls = mutableListOf<ToolCall>()
        val callArray = response.optJSONArray("toolCalls") ?: JSONArray()

        for (i in 0 until callArray.length()) {
            val call = callArray.getJSONObject(i)
            calls += ToolCall(
                id = call.optString("id"),
                name = call.getString("name"),
                arguments = call.optJSONObject("arguments").toMap()
            )
        }

        return ModelResponse(
            text = response.optString("text"),
            toolCalls = calls,
            isFinal = response.optBoolean("isFinal", calls.isEmpty())
        )
    }

    private fun AgentMessage.toJson(): JSONObject = when (this) {
        is AgentMessage.User -> JSONObject()
            .put("type", "user")
            .put("content", content)

        is AgentMessage.Assistant -> JSONObject()
            .put("type", "assistant")
            .put("content", content)
            .put("toolCalls", JSONArray().apply {
                toolCalls.forEach { put(it.toJson()) }
            })

        is AgentMessage.ToolResult -> JSONObject()
            .put("type", "tool_result")
            .put("toolName", toolName)
            .put("callId", callId)
            .put("content", content)
    }

    private fun ToolCall.toJson() = JSONObject()
        .put("id", id)
        .put("name", name)
        .put("arguments", JSONObject(arguments))

    private fun ToolSchema.toJson() = JSONObject()
        .put("name", name)
        .put("description", description)
        .put("parameters", JSONArray().apply {
            parameters.forEach { parameter ->
                put(JSONObject()
                    .put("name", parameter.name)
                    .put("type", parameter.type.name)
                    .put("description", parameter.description)
                    .put("required", parameter.required)
                    .put("enumValues", JSONArray(parameter.enumValues)))
            }
        })

    private fun JSONObject?.toMap(): Map<String, Any?> {
        if (this == null) return emptyMap()
        return keys().asSequence().associateWith { key ->
            when (val value = get(key)) {
                JSONObject.NULL -> null
                is JSONObject -> value.toMap()
                is JSONArray -> value.toList()
                else -> value
            }
        }
    }

    private fun JSONArray.toList(): List<Any?> =
        (0 until length()).map { index ->
            when (val value = get(index)) {
                JSONObject.NULL -> null
                is JSONObject -> value.toMap()
                is JSONArray -> value.toList()
                else -> value
            }
        }
}