package com.viole.jarvis.tools

import android.content.Context

class OpenAppTool(private val context: Context) : Tool {
    override val name = "open_app"
    override val description = "Open an installed Android application by its package name."
    override val parameters = listOf(
        ToolParameter("packageName", ParameterType.STRING, "Android package name.", required = true)
    )
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult {
        val packageName = arguments["packageName"] as? String
            ?: return ToolExecutionResult.Error("packageName is required.")
        return AndroidTools.openApp(context, packageName).fold(
            { ToolExecutionResult.Success("Application opened: " + packageName) },
            { ToolExecutionResult.Error(it.message ?: "Could not open application.") }
        )
    }
}

class ReadScreenTool : Tool {
    override val name = "read_screen"
    override val description = "Read accessible text, descriptions, and resource IDs from the active window."
    override val parameters = emptyList<ToolParameter>()
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult =
        ToolExecutionResult.Success(
            AndroidTools.readScreen().ifEmpty { listOf("No accessible elements found.") }.joinToString("\n")
        )
}

class ClickTool : Tool {
    override val name = "click"
    override val description = "Click an accessible UI element by text, content description, or resource ID."
    override val parameters = listOf(
        ToolParameter("text", ParameterType.STRING, "Exact visible text."),
        ToolParameter("contentDescription", ParameterType.STRING, "Exact accessibility description."),
        ToolParameter("resourceId", ParameterType.STRING, "Android resource ID.")
    )
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult =
        AndroidTools.click(
            arguments["text"] as? String,
            arguments["contentDescription"] as? String,
            arguments["resourceId"] as? String
        ).fold(
            { ToolExecutionResult.Success("Click executed.") },
            { ToolExecutionResult.Error(it.message ?: "Could not click element.") }
        )
}

class TypeTextTool : Tool {
    override val name = "type_text"
    override val description = "Set text in an editable Android field."
    override val parameters = listOf(
        ToolParameter("text", ParameterType.STRING, "Text to enter.", required = true),
        ToolParameter("targetText", ParameterType.STRING, "Visible text of target field."),
        ToolParameter("targetResourceId", ParameterType.STRING, "Resource ID of target field.")
    )
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult {
        val text = arguments["text"] as? String
            ?: return ToolExecutionResult.Error("text is required.")
        return AndroidTools.typeText(
            text,
            arguments["targetText"] as? String,
            arguments["targetResourceId"] as? String
        ).fold(
            { ToolExecutionResult.Success("Text entered.") },
            { ToolExecutionResult.Error(it.message ?: "Could not enter text.") }
        )
    }
}

class ScrollTool : Tool {
    override val name = "scroll"
    override val description = "Scroll the active scrollable Android element."
    override val parameters = listOf(
        ToolParameter("direction", ParameterType.STRING, "Scroll direction.", required = true, enumValues = listOf("up", "down"))
    )
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult {
        val direction = when ((arguments["direction"] as? String)?.lowercase()) {
            "up" -> AndroidTools.ScrollDirection.UP
            "down" -> AndroidTools.ScrollDirection.DOWN
            else -> return ToolExecutionResult.Error("direction must be 'up' or 'down'.")
        }
        return AndroidTools.scroll(direction).fold(
            { ToolExecutionResult.Success("Scroll executed: " + direction.name.lowercase()) },
            { ToolExecutionResult.Error(it.message ?: "Could not scroll.") }
        )
    }
}

class BackTool : Tool {
    override val name = "back"
    override val description = "Navigate back using Android's global Back action."
    override val parameters = emptyList<ToolParameter>()
    override suspend fun execute(arguments: Map<String, Any?>): ToolExecutionResult =
        AndroidTools.back().fold(
            { ToolExecutionResult.Success("Back action executed.") },
            { ToolExecutionResult.Error(it.message ?: "Could not navigate back.") }
        )
}
