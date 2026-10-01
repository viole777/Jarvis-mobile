package com.viole.jarvis.agent

import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.ToolExecutionResult
import com.viole.jarvis.tools.ToolExecutor

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
    private val registry: AndroidToolRegistry
) {
    private val executor = ToolExecutor(registry)
    private val messages = mutableListOf<AgentMessage>()
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
            return continueLoop(maxRetriesPerTool)
        }

        val result = executor.executeConfirmed(call.name, call.arguments)
        messages += AgentMessage.ToolResult(
            call.name,
            call.id,
            result.toOutput()
        )

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
                    }

                    is ToolExecutionResult.Error -> {
                        messages += AgentMessage.ToolResult(
                            call.name,
                            call.id,
                            "Erro: " + result.message
                        )

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
        pending = null
        roundsRemaining = 0
    }

    private fun ToolExecutionResult.toOutput(): String = when (this) {
        is ToolExecutionResult.Success -> output
        is ToolExecutionResult.Error -> "Erro: " + message
        is ToolExecutionResult.ConfirmationRequired -> "Confirmação pendente."
    }
}