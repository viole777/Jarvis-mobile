package com.viole.jarvis.agent

import com.viole.jarvis.tools.ToolSchema

class MockModelClient : ModelClient {
    override suspend fun generate(messages: List<AgentMessage>, tools: List<ToolSchema>): ModelResponse {
        val latest = messages.lastOrNull { it is AgentMessage.User } as? AgentMessage.User
            ?: return ModelResponse(text = "Não recebi um comando.")

        val command = latest.content.lowercase()
        return when {
            command.startsWith("volte") || command == "voltar" ->
                ModelResponse(toolCalls = listOf(ToolCall("back", emptyMap())), isFinal = false)
            command.contains("leia a tela") || command.contains("ler a tela") ->
                ModelResponse(toolCalls = listOf(ToolCall("read_screen", emptyMap())), isFinal = false)
            else -> ModelResponse(text = "Modo de demonstração: ainda não há um modelo conectado para interpretar este comando.")
        }
    }
}
