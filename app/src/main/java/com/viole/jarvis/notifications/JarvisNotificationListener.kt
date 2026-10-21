package com.viole.jarvis.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * Reads notification previews only after the user explicitly enables
 * Jarvis in Android's Notification access settings.
 */
class JarvisNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val item = sbn ?: return
        if (item.packageName == packageName) return

        val extras = item.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?.takeIf { it.isNotBlank() }
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (title.isBlank() && text.isBlank()) return

        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val existing = runCatching {
            JSONArray(prefs.getString(KEY_ITEMS, "[]") ?: "[]")
        }.getOrDefault(JSONArray())
        val entry = JSONObject()
            .put("packageName", item.packageName.take(180))
            .put("title", title.take(300))
            .put("text", text.take(1800))
            .put("postedAt", item.postTime)
            .put("capturedAt", System.currentTimeMillis())
        val next = JSONArray()
        next.put(entry)
        for (i in 0 until minOf(existing.length(), MAX_ITEMS - 1)) {
            val old = existing.optJSONObject(i) ?: continue
            if (old.optLong("postedAt") != item.postTime ||
                old.optString("packageName") != item.packageName ||
                old.optString("title") != title) next.put(old)
        }
        prefs.edit().putString(KEY_ITEMS, next.toString()).apply()
    }

    companion object {
        const val PREFS = "jarvis_notification_inbox"
        const val KEY_ITEMS = "items"
        private const val MAX_ITEMS = 40
    }
}
