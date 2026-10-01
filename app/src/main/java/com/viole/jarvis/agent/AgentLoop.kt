package com.viole.jarvis.agent

import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.ToolExecutionResult
import com.viole.jarvis.tools.ToolExecutor

class AgentLoop(
    private val model: ModelClient,
    private val registry: AndroidToolRegistry
) {
    private val executor = ToolExecutor(registry)
    private val messages = mutableListOf<AgentMessage>()

    suspend fun run(userInput: String, maxToolRounds: Int = 8): String {
        messages += AgentMessage.User(userInput)

        repeat(maxToolRounds) {
            val response = model.generate(
                messages.toList(),
                registry.all().map { it.toSchema() }
            )

            messages += AgentMessage.Assistant(response.text, response.toolCalls)

            if (response.toolCalls.isEmpty()) {
                return response.text.ifBlank { "Concluído." }
            }

            for (call in response.toolCalls) {
                val result = executor.execute(call.name, call.arguments)
                val output = when (result) {
                    is ToolExecutionResult.Success -> result.output
                    is ToolExecutionResult.Error -> "Erro: " + result.message
                }

                messages += AgentMessage.ToolResult(call.name, call.id, output)
            }
        }

        return "Interrompi a tarefa porque o limite de etapas foi atingido."
    }

    fun clearHistory() {
        messages.clear()
    }
}