package com.viole.jarvis.tools

class ToolExecutor(private val registry: AndroidToolRegistry) {
    suspend fun execute(toolName: String, arguments: Map<String, Any?>): ToolExecutionResult {
        val tool = registry.get(toolName)
            ?: return ToolExecutionResult.Error("Unknown tool: " + toolName)

        val missing = tool.parameters.filter { it.required && arguments[it.name] == null }.map { it.name }
        if (missing.isNotEmpty()) {
            return ToolExecutionResult.Error("Missing required parameters: " + missing.joinToString(", "))
        }

        return tool.execute(arguments)
    }
}
