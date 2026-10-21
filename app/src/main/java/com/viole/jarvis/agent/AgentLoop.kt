package com.viole.jarvis.agent

import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.ToolExecutionResult
import com.viole.jarvis.tools.ToolExecutor
import com.viole.jarvis.tools.toSchema
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

sealed interface AgentRunResult {
    data class Completed(val text: String) : AgentRunResult
    data class NeedsConfirmation(
        val toolCallId: String,
        val toolName: String,
        val arguments: Map<String, Any?>,
        val reason: String
    ) : AgentRunResult
    data class Failed(val message: String) : AgentRunResult
}

class AgentLoop(
    private val model: ModelClient,
    private val registry: AndroidToolRegistry,
    context: Context? = null
) {
    private val executor = ToolExecutor(registry)
    private val prefs = context?.applicationContext?.getSharedPreferences("jarvis_memory", Context.MODE_PRIVATE)
    private val messages = mutableListOf<AgentMessage>().apply { addAll(loadMessages()) }

    private fun saveMessages() {
        val json = JSONArray()
        messages.takeLast(80).forEach { message ->
            val item = JSONObject()
            when (message) {
                is AgentMessage.User -> item.put("type", "user").put("content", message.content)
                is AgentMessage.Assistant -> {
                    item.put("type", "assistant").put("content", message.content)
                    item.put("calls", JSONArray().apply {
                        message.toolCalls.forEach { call ->
                            put(JSONObject().put("id", call.id).put("name", call.name)
                                .put("arguments", JSONObject(call.arguments)))
                        }
                    })
                }
                is AgentMessage.ToolResult -> item.put("type", "tool")
                    .put("name", message.toolName).put("id", message.callId).put("content", message.content)
            }
            json.put(item)
        }
        prefs?.edit()?.putString("conversation_v1", json.toString())?.apply()
        if (messages.size > 80) {
            messages.subList(0, messages.size - 80).clear()
        }
    }

    private fun loadMessages(): List<AgentMessage> = runCatching {
        val json = JSONArray(prefs?.getString("conversation_v1", "[]") ?: "[]")
        (0 until json.length()).mapNotNull { index ->
            val item = json.getJSONObject(index)
            when (item.optString("type")) {
                "user" -> AgentMessage.User(item.optString("content"))
                "assistant" -> {
                    val calls = item.optJSONArray("calls") ?: JSONArray()
                    val parsedCalls = (0 until calls.length()).map { i ->
                        val call = calls.getJSONObject(i)
                        ToolCall(call.optString("id"), call.optString("name"), call.optJSONObject("arguments").toAnyMap())
                    }
                    AgentMessage.Assistant(item.optString("content"), parsedCalls)
                }
                "tool" -> AgentMessage.ToolResult(item.optString("name"), item.optString("id"), item.optString("content"))
                else -> null
            }
        }
    }.getOrDefault(emptyList())

    private fun JSONObject?.toAnyMap(): Map<String, Any?> {
        if (this == null) return emptyMap()
        return keys().asSequence().associateWith { key ->
            when (val value = get(key)) {
                JSONObject.NULL -> null
                is JSONObject -> value.toAnyMap()
                is JSONArray -> (0 until value.length()).map { i ->
                    when (val item = value.get(i)) {
                        JSONObject.NULL -> null
                        is JSONObject -> item.toAnyMap()
                        is JSONArray -> (0 until item.length()).map { j -> item.get(j) }
                        else -> item
                    }
                }
                else -> value
            }
        }
    }
    private var pending: ToolCall? = null
    private var roundsRemaining = 0

    suspend fun run(
        userInput: String,
        maxToolRounds: Int = 12,
        maxRetriesPerTool: Int = 1
    ): AgentRunResult {
        if (pending != null) {
            return AgentRunResult.Failed("Existe uma ação aguardando confirmação.")
        }

        messages += AgentMessage.User(userInput)
        saveMessages()
        roundsRemaining = maxToolRounds
        return continueLoop(maxRetriesPerTool)
    }

    suspend fun confirmPending(
        approved: Boolean,
        maxRetriesPerTool: Int = 1
    ): AgentRunResult {
        val call = pending
            ?: return AgentRunResult.Failed("Não há ação aguardando confirmação.")

        pending = null

        if (!approved) {
            messages += AgentMessage.ToolResult(
                call.name,
                call.id,
                "Ação recusada pelo usuário."
            )
            saveMessages()
            return continueLoop(maxRetriesPerTool)
        }

        val result = executor.executeConfirmed(call.name, call.arguments)
        messages += AgentMessage.ToolResult(
            call.name,
            call.id,
            result.toOutput()
        )
        saveMessages()

        return continueLoop(maxRetriesPerTool)
    }

    private suspend fun continueLoop(maxRetriesPerTool: Int): AgentRunResult {
        var retries = 0

        while (roundsRemaining > 0) {
            roundsRemaining--

            val response = try {
                model.generate(
                    messages.toList(),
                    registry.all().map { it.toSchema() }
                )
            } catch (error: Exception) {
                return AgentRunResult.Failed(
                    error.message ?: "Falha ao consultar o modelo."
                )
            }

            messages += AgentMessage.Assistant(response.text, response.toolCalls)
            saveMessages()

            if (response.toolCalls.isEmpty()) {
                return AgentRunResult.Completed(
                    response.text.ifBlank { "Concluído." }
                )
            }

            for (call in response.toolCalls) {
                when (val result = executor.execute(call.name, call.arguments)) {
                    is ToolExecutionResult.Success -> {
                        retries = 0
                        messages += AgentMessage.ToolResult(
                            call.name,
                            call.id,
                            result.output
                        )
                        saveMessages()
                    }

                    is ToolExecutionResult.Error -> {
                        messages += AgentMessage.ToolResult(
                            call.name,
                            call.id,
                            "Erro: " + result.message
                        )
                        saveMessages()

                        if (retries < maxRetriesPerTool) {
                            retries++
                        } else {
                            return AgentRunResult.Failed(
                                "A ferramenta " + call.name +
                                    " falhou: " + result.message
                            )
                        }
                    }

                    is ToolExecutionResult.ConfirmationRequired -> {
                        pending = call
                        return AgentRunResult.NeedsConfirmation(
                            call.id,
                            call.name,
                            call.arguments,
                            result.reason
                        )
                    }
                }
            }
        }

        return AgentRunResult.Failed(
            "Interrompi a tarefa porque o limite de etapas foi atingido."
        )
    }

    fun clearHistory() {
        messages.clear()
        prefs?.edit()?.remove("conversation_v1")?.apply()
        pending = null
        roundsRemaining = 0
    }

    private fun ToolExecutionResult.toOutput(): String = when (this) {
        is ToolExecutionResult.Success -> output
        is ToolExecutionResult.Error -> "Erro: " + message
        is ToolExecutionResult.ConfirmationRequired -> "Confirmação pendente."
    }
}