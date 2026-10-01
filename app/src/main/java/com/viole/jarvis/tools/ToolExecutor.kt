package com.viole.jarvis.tools

class ToolExecutor(
    private val registry: AndroidToolRegistry,
    private val safetyEngine: SafetyEngine = SafetyEngine()
) {
    suspend fun execute(
        toolName: String,
        arguments: Map<String, Any?>
    ): ToolExecutionResult {
        val tool = registry.get(toolName)
            ?: return ToolExecutionResult.Error("Unknown tool: " + toolName)

        val missing = tool.parameters
            .filter { it.required && arguments[it.name] == null }
            .map { it.name }

        if (missing.isNotEmpty()) {
            return ToolExecutionResult.Error(
                "Missing required parameters: " + missing.joinToString(", ")
            )
        }

        val policy = safetyEngine.evaluate(tool, arguments)
        if (!policy.allowed) {
            return ToolExecutionResult.Error(
                policy.reason ?: "Ação bloqueada pela Safety Engine."
            )
        }

        val heuristic = safetyEngine.evaluateSensitiveTextAction(toolName, arguments)
        if (heuristic.requiresConfirmation) {
            return ToolExecutionResult.ConfirmationRequired(
                reason = heuristic.reason ?: "Confirmação necessária.",
                toolName = toolName,
                arguments = arguments
            )
        }

        if (policy.requiresConfirmation) {
            return ToolExecutionResult.ConfirmationRequired(
                reason = policy.reason ?: "Confirmação necessária.",
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
            ?: return ToolExecutionResult.Error("Unknown tool: " + toolName)

        return tool.execute(arguments)
    }
}