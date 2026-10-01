package com.viole.jarvis.tools

interface Tool {
    val name: String
    val description: String
    val parameters: List<ToolParameter>
    val riskLevel: RiskLevel get() = RiskLevel.NONE

    fun confirmationReason(arguments: Map<String, Any?>): String =
        "O Jarvis quer executar a ferramenta " + name + "."

    suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult
}

data class ToolParameter(
    val name: String,
    val type: ParameterType,
    val description: String,
    val required: Boolean = false,
    val enumValues: List<String> = emptyList()
)

enum class ParameterType { STRING, BOOLEAN, INTEGER }

sealed interface ToolExecutionResult {
    data class Success(val output: String) : ToolExecutionResult
    data class Error(val message: String) : ToolExecutionResult
    data class ConfirmationRequired(
        val reason: String,
        val toolName: String,
        val arguments: Map<String, Any?>
    ) : ToolExecutionResult
}