package com.viole.jarvis.tools

enum class RiskLevel { NONE, LOW, HIGH }

data class SafetyDecision(
    val allowed: Boolean,
    val requiresConfirmation: Boolean,
    val reason: String? = null
)

class SafetyEngine {
    fun evaluate(tool: Tool, arguments: Map<String, Any?>): SafetyDecision {
        if (tool.riskLevel == RiskLevel.NONE || tool.riskLevel == RiskLevel.LOW) {
            return SafetyDecision(allowed = true, requiresConfirmation = false)
        }

        return SafetyDecision(
            allowed = true,
            requiresConfirmation = true,
            reason = tool.confirmationReason(arguments)
        )
    }

    fun evaluateSensitiveTextAction(
        toolName: String,
        arguments: Map<String, Any?>
    ): SafetyDecision {
        if (toolName != "click") return SafetyDecision(true, false)

        val target = listOf(
            arguments["text"],
            arguments["contentDescription"]
        ).filterIsInstance<String>().joinToString(" ").lowercase()

        val sensitiveWords = listOf(
            "comprar", "finalizar compra", "pagar", "enviar",
            "excluir", "apagar", "remover", "confirmar pedido"
        )

        val matched = sensitiveWords.firstOrNull { target.contains(it) }
        return if (matched != null) {
            SafetyDecision(
                allowed = true,
                requiresConfirmation = true,
                reason = "A ação pode confirmar uma operação sensível: " + matched + "."
            )
        } else {
            SafetyDecision(true, false)
        }
    }
}