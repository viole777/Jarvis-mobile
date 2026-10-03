package com.viole.jarvis.tools

import android.content.Context

class AndroidToolRegistry(private val context: Context) {
    private val tools = listOf(
        OpenAppTool(context),
        ReadScreenTool(),
        InspectScreenTool(),
        ClickTool(),
        TypeTextTool(),
        ScrollTool(),
        BackTool()
    )

    fun all(): List<Tool> = tools
    fun get(name: String): Tool? = tools.firstOrNull { it.name == name }
}
