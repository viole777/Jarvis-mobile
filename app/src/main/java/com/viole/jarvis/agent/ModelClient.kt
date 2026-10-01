package com.viole.jarvis.agent

import com.viole.jarvis.tools.ToolSchema

interface ModelClient {
    suspend fun generate(messages: List<AgentMessage>, tools: List<ToolSchema>): ModelResponse
}
