package com.viole.jarvis.tools

import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityNodeInfo
import com.viole.jarvis.accessibility.JarvisAccessibilityService

object AndroidTools {
    fun readScreen(): List<String> {
        val root = JarvisAccessibilityService.instance?.activeRoot() ?: return emptyList()
        return buildList { collectNodes(root, this) }
    }

    fun openApp(context: Context, packageName: String): Result<Unit> = runCatching {
        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: error("Aplicativo não encontrado: \$packageName")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun click(text: String? = null, contentDescription: String? = null, resourceId: String? = null): Result<Unit> {
        val root = JarvisAccessibilityService.instance?.activeRoot()
            ?: return Result.failure(IllegalStateException("Accessibility Service não está ativo."))
        val node = findNode(root, text, contentDescription, resourceId)
            ?: return Result.failure(IllegalArgumentException("Elemento não encontrado."))
        val clickable = findClickableAncestor(node) ?: node.takeIf { it.isClickable }
        return if (clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) Result.success(Unit)
        else Result.failure(IllegalStateException("Não foi possível clicar no elemento."))
    }

    fun typeText(text: String, targetText: String? = null, targetResourceId: String? = null): Result<Unit> {
        val root = JarvisAccessibilityService.instance?.activeRoot()
            ?: return Result.failure(IllegalStateException("Accessibility Service não está ativo."))
        val node = findNode(root, targetText, null, targetResourceId)
            ?: findFocusedEditable(root)
            ?: return Result.failure(IllegalArgumentException("Campo de texto não encontrado."))
        if (!node.isEditable) return Result.failure(IllegalArgumentException("O elemento encontrado não é editável."))
        val args = android.os.Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) Result.success(Unit)
        else Result.failure(IllegalStateException("Não foi possível inserir o texto."))
    }

    fun scroll(direction: ScrollDirection): Result<Unit> {
        val root = JarvisAccessibilityService.instance?.activeRoot()
            ?: return Result.failure(IllegalStateException("Accessibility Service não está ativo."))
        val action = when (direction) {
            ScrollDirection.UP -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            ScrollDirection.DOWN -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        }
        val scrollable = findScrollable(root)
            ?: return Result.failure(IllegalStateException("Nenhum elemento rolável encontrado."))
        return if (scrollable.performAction(action)) Result.success(Unit)
        else Result.failure(IllegalStateException("Não foi possível rolar a tela."))
    }

    fun back(): Result<Unit> {
        val service = JarvisAccessibilityService.instance
            ?: return Result.failure(IllegalStateException("Accessibility Service não está ativo."))
        return if (service.performGlobalAction(JarvisAccessibilityService.GLOBAL_ACTION_BACK)) Result.success(Unit)
        else Result.failure(IllegalStateException("Não foi possível voltar."))
    }

    private fun collectNodes(node: AccessibilityNodeInfo, output: MutableList<String>) {
        node.text?.toString()?.takeIf { it.isNotBlank() }?.let { output += "text: \$it" }
        node.contentDescription?.toString()?.takeIf { it.isNotBlank() }?.let { output += "description: \$it" }
        node.viewIdResourceName?.let { output += "id: \$it" }
        for (index in 0 until node.childCount) node.getChild(index)?.let { child ->
            collectNodes(child, output)
            child.recycle()
        }
    }

    private fun findNode(root: AccessibilityNodeInfo, text: String?, contentDescription: String?, resourceId: String?): AccessibilityNodeInfo? {
        if ((text == null || root.text?.toString() == text) &&
            (contentDescription == null || root.contentDescription?.toString() == contentDescription) &&
            (resourceId == null || root.viewIdResourceName == resourceId)) return root
        for (index in 0 until root.childCount) root.getChild(index)?.let { child ->
            val result = findNode(child, text, contentDescription, resourceId)
            if (result != null) return result
            child.recycle()
        }
        return null
    }

    private fun findClickableAncestor(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }

    private fun findFocusedEditable(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.isEditable && root.isFocused) return root
        for (index in 0 until root.childCount) root.getChild(index)?.let { child ->
            val result = findFocusedEditable(child)
            if (result != null) return result
            child.recycle()
        }
        return null
    }

    private fun findScrollable(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.isScrollable) return root
        for (index in 0 until root.childCount) root.getChild(index)?.let { child ->
            val result = findScrollable(child)
            if (result != null) return result
            child.recycle()
        }
        return null
    }

    enum class ScrollDirection { UP, DOWN }
}
