package com.viole.jarvis.tools

import android.content.Context

/**
 * Stable contracts exposed to the future agent.
 *
 * The LLM will eventually receive these names, descriptions and JSON-like
 * parameters. Keeping the contract separate from Android implementation
 * prevents the model layer from depending on Android classes.
 */
data class JarvisToolDefinition(
    val name: String,
    val description: String,
    val parameters: List<ToolParameter>
)

data class ToolParameter(
    val name: String,
    val type: String,
    val required: Boolean,
    val description: String
)

object JarvisToolRegistry {

    val definitions = listOf(
        JarvisToolDefinition(
            name = "open_app",
            description = "Open an installed Android application by package name.",
            parameters = listOf(
                ToolParameter(
                    "package_name", "string", true,
                    "Android package name, for example com.android.chrome."
                )
            )
        ),
        JarvisToolDefinition(
            name = "click",
            description = "Click a visible accessible UI element by text, content description, or resource ID.",
            parameters = listOf(
                ToolParameter("text", "string", false, "Exact visible text."),
                ToolParameter("content_description", "string", false, "Accessibility content description."),
                ToolParameter("resource_id", "string", false, "Android view resource ID.")
            )
        ),
        JarvisToolDefinition(
            name = "type_text",
            description = "Replace the text of a focused or identified editable field.",
            parameters = listOf(
                ToolParameter("text", "string", true, "Text to insert."),
                ToolParameter("target_text", "string", false, "Text identifying the target field."),
                ToolParameter("target_resource_id", "string", false, "Resource ID identifying the target field.")
            )
        ),
        JarvisToolDefinition(
            name = "scroll",
            description = "Scroll the first accessible scrollable container.",
            parameters = listOf(
                ToolParameter("direction", "string", true, "Either up or down.")
            )
        ),
        JarvisToolDefinition(
            name = "back",
            description = "Navigate back using Android's global back action.",
            parameters = emptyList()
        ),
        JarvisToolDefinition(
            name = "read_screen",
            description = "Read accessible text, content descriptions, and resource IDs from the active window.",
            parameters = emptyList()
        )
    )
}

class AndroidToolExecutor(private val context: Context) {

    fun execute(name: String, arguments: Map<String, String>): ToolExecutionResult {
        return when (name) {
            "read_screen" -> ToolExecutionResult.Success(
                AndroidTools.readScreen().joinToString("\n")
            )

            "open_app" -> {
                val packageName = arguments["package_name"]
                    ?: return ToolExecutionResult.Failure("Missing required argument: package_name")
                AndroidTools.openApp(context, packageName).toToolResult("App opened.")
            }

            "click" -> AndroidTools.click(
                text = arguments["text"],
                contentDescription = arguments["content_description"],
                resourceId = arguments["resource_id"]
            ).toToolResult("Element clicked.")

            "type_text" -> {
                val text = arguments["text"]
                    ?: return ToolExecutionResult.Failure("Missing required argument: text")
                AndroidTools.typeText(
                    text = text,
                    targetText = arguments["target_text"],
                    targetResourceId = arguments["target_resource_id"]
                ).toToolResult("Text entered.")
            }

            "scroll" -> {
                val direction = when (arguments["direction"]?.lowercase()) {
                    "up" -> AndroidTools.ScrollDirection.UP
                    "down" -> AndroidTools.ScrollDirection.DOWN
                    else -> return ToolExecutionResult.Failure(
                        "direction must be 'up' or 'down'."
                    )
                }
                AndroidTools.scroll(direction).toToolResult("Scroll executed.")
            }

            "back" -> AndroidTools.back().toToolResult("Back executed.")

            else -> ToolExecutionResult.Failure("Unknown tool: $name")
        }
    }

    private fun Result<Unit>.toToolResult(successMessage: String): ToolExecutionResult =
        fold(
            onSuccess = { ToolExecutionResult.Success(successMessage) },
            onFailure = { ToolExecutionResult.Failure(it.message ?: "Tool execution failed.") }
        )
}

sealed interface ToolExecutionResult {
    data class Success(val output: String) : ToolExecutionResult
    data class Failure(val error: String) : ToolExecutionResult
}
