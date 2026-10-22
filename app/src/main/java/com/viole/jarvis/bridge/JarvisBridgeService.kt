package com.viole.jarvis.bridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Minimal, user-started bridge worker. The user must pair the device first and
 * store its per-device credential in JarvisBridgePrefs.DEVICE_TOKEN.
 * It never accepts arbitrary code, shell commands, or arbitrary intents.
 */
class JarvisBridgeService : Service() {
    companion object {
        const val ACTION_START = "com.viole.jarvis.bridge.START"
        const val ACTION_STOP = "com.viole.jarvis.bridge.STOP"
        const val PREFS = "jarvis_bridge"
        const val DEVICE_TOKEN = "device_token"
        const val DEVICE_ID = "device_id"
        private const val CHANNEL_ID = "jarvis_device_bridge"
        private const val NOTIFICATION_ID = 7301
        private const val BASE_URL = "https://jarvis-v2-cloud.viole-jarvis.workers.dev"
    }

    private val running = AtomicBoolean(false)
    @Volatile private var worker: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            running.set(false)
            worker?.interrupt()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val token = getSharedPreferences(PREFS, MODE_PRIVATE).getString(DEVICE_TOKEN, null)
        if (token.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        startForeground(NOTIFICATION_ID, notification("Ponte ativa; aguardando comandos autorizados"))
        if (running.compareAndSet(false, true)) {
            worker = Thread { pollLoop(token) }.also { it.name = "JarvisDeviceBridge"; it.start() }
        }
        return START_NOT_STICKY
    }

    private fun pollLoop(token: String) {
        while (running.get() && !Thread.currentThread().isInterrupted) {
            try {
                val response = request("GET", "/v2/device/poll", token, null)
                if (response.optBoolean("ok")) {
                    val command = response.optJSONObject("command")
                    if (command != null) {
                        val id = command.optString("id")
                        val expires = command.optString("expiresAt")
                        val success: Boolean
                        val message: String
                        try {
                            if (expires.isBlank() || java.time.Instant.parse(expires).isBefore(java.time.Instant.now())) {
                                throw IllegalArgumentException("Comando expirado")
                            }
                            if (command.optString("action") != "open_app") throw IllegalArgumentException("Ação não permitida")
                            val payload = command.optJSONObject("payload") ?: throw IllegalArgumentException("Payload inválido")
                            val packageName = payload.optString("packageName")
                            if (!packageName.matches(Regex("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+"))) throw IllegalArgumentException("Pacote inválido")
                            val launch = packageManager.getLaunchIntentForPackage(packageName)
                                ?: throw IllegalArgumentException("Aplicativo não instalado ou sem tela de abertura")
                            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(launch)
                            success = true
                            message = "Solicitada abertura de " + packageName
                        } catch (e: Exception) {
                            success = false
                            message = (e.message ?: "Falha na execução").take(250)
                        }
                        val result = JSONObject().put("id", id).put("success", success).put("result", message)
                        request("POST", "/v2/device/result", token, result)
                    }
                }
            } catch (_: Exception) {
                // Temporary network failures are retried; no sensitive payload is logged.
            }
            try { Thread.sleep(5000) } catch (_: InterruptedException) { break }
        }
        running.set(false)
    }

    private fun request(method: String, path: String, token: String, body: JSONObject?): JSONObject {
        val connection = (URL(BASE_URL + path).openConnection() as HttpURLConnection)
        try {
            connection.requestMethod = method
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            return JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Ponte do Jarvis", NotificationManager.IMPORTANCE_LOW))
        }
    }

    private fun notification(message: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("Jarvis — ponte do dispositivo")
            .setContentText(message)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
}
