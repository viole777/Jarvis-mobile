package com.viole.jarvis.tools

class InspectScreenTool : Tool {
    override val name = "inspect_screen"
    override val description = "Inspect the active Android screen as structured UI elements, including text, descriptions, IDs, bounds, and interaction state."
    override val parameters = emptyList<ToolParameter>()

    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult =
        ToolExecutionResult.Success(AndroidTools.inspectScreen())
}
