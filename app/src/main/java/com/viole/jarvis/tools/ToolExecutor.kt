package com.viole.jarvis.tools

/**
 * Minimal execution gate for Android tools.
 *
 * Speech-to-text transcription is not speaker authentication, so consequential
 * actions still require an explicit confirmation. Routine navigation and read
 * operations remain direct.
 */
class ToolExecutor(
    private val registry: AndroidToolRegistry
) {
    suspend fun execute(
        toolName: String,
        arguments: Map<String, Any?>
    ): ToolExecutionResult {
        val tool = registry.get(toolName)
            ?: return ToolExecutionResult.Error("Ferramenta desconhecida: " + toolName)

        val missing = tool.parameters
            .filter { it.required && arguments[it.name] == null }
            .map { it.name }

        if (missing.isNotEmpty()) {
            return ToolExecutionResult.Error(
                "Parâmetros obrigatórios ausentes: " + missing.joinToString(", ")
            )
        }

        val sensitiveClick = isSensitiveTextAction(toolName, arguments)
        val highRisk = tool.riskLevel == RiskLevel.HIGH
        if (sensitiveClick || highRisk) {
            val reason = if (sensitiveClick) {
                "A interface indica uma ação sensível (enviar, pagar, comprar ou excluir)."
            } else {
                tool.confirmationReason(arguments)
            }
            return ToolExecutionResult.ConfirmationRequired(
                reason = reason,
                toolName = toolName,
                arguments = arguments
            )
        }

        return tool.execute(arguments)
    }

    suspend fun executeConfirmed(
        toolName: String,
        arguments: Map<String, Any?>
    ): ToolExecutionResult {
        val tool = registry.get(toolName)
            ?: return ToolExecutionResult.Error("Ferramenta desconhecida: " + toolName)

        val missing = tool.parameters
            .filter { it.required && arguments[it.name] == null }
            .map { it.name }

        if (missing.isNotEmpty()) {
            return ToolExecutionResult.Error(
                "Parâmetros obrigatórios ausentes: " + missing.joinToString(", ")
            )
        }

        return tool.execute(arguments)
    }

    private fun isSensitiveTextAction(
        toolName: String,
        arguments: Map<String, Any?>
    ): Boolean {
        if (toolName != "click") return false

        val target = listOf(
            arguments["text"],
            arguments["contentDescription"]
        ).filterIsInstance<String>().joinToString(" ").lowercase()

        val sensitiveWords = listOf(
            "comprar", "finalizar compra", "pagar", "enviar",
            "excluir", "apagar", "remover", "confirmar pedido"
        )
        return sensitiveWords.any(target::contains)
    }
}
