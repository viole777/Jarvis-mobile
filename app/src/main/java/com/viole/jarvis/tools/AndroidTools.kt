package com.viole.jarvis.tools

import android.view.accessibility.AccessibilityNodeInfo
import com.viole.jarvis.accessibility.JarvisAccessibilityService

object AndroidTools {

    fun readScreen(): List<String> {
        val root = JarvisAccessibilityService.instance?.activeRoot()
            ?: return emptyList()

        return buildList {
            collectNodes(root, this)
        }
    }

    private fun collectNodes(
        node: AccessibilityNodeInfo,
        output: MutableList<String>
    ) {
        node.text?.toString()
            ?.takeIf { it.isNotBlank() }
            ?.let { output += "text: $it" }

        node.contentDescription?.toString()
            ?.takeIf { it.isNotBlank() }
            ?.let { output += "description: $it" }

        for (index in 0 until node.childCount) {
            node.getChild(index)?.let { child ->
                collectNodes(child, output)
                child.recycle()
            }
        }
    }
}
