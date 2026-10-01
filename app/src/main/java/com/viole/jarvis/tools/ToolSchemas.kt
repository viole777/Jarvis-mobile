package com.viole.jarvis.tools

data class ToolSchema(
    val name: String,
    val description: String,
    val parameters: List<ToolParameter>
)

fun Tool.toSchema(): ToolSchema = ToolSchema(name, description, parameters)
