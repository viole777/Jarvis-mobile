package com.viole.jarvis.agent

sealed interface AgentMessage {
    data class User(val content: String) : AgentMessage
    data class Assistant(
        val content: String,
        val toolCalls: List<ToolCall> = emptyList()
    ) : AgentMessage
    data class ToolResult(
        val toolName: String,
        val callId: String,
        val content: String
    ) : AgentMessage
}

data class ToolCall(
    val id: String,
    val name: String,
    val arguments: Map<String, Any?>
)

data class ModelResponse(
    val text: String = "",
    val toolCalls: List<ToolCall> = emptyList(),
    val isFinal: Boolean = true
)