package com.popcorntime.mobile

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

object UpdateManager {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private val cancelled = AtomicBoolean(false)

    fun cancel() {
        cancelled.set(true)
    }

    fun downloadAndInstallApk(
        context: Context,
        downloadUrl: String,
        onProgress: (percent: Int, label: String) -> Unit
    ): String {
        cancelled.set(false)
        if (!downloadUrl.startsWith("https://")) {
            return JSONObject().put("ok", false).put("error", "Only HTTPS APK URLs are allowed").toString()
        }
        return try {
            val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
            val apkFile = File(updatesDir, "Popcorn-Time-update.apk")
            if (apkFile.exists()) apkFile.delete()

            val req = Request.Builder()
                .url(downloadUrl)
                .header("User-Agent", "Popcorn-Time-AndroidTV")
                .build()

            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) {
                    return JSONObject().put("ok", false).put("error", "Download failed: HTTP ${res.code}").toString()
                }
                val body = res.body ?: return JSONObject().put("ok", false).put("error", "Empty response").toString()
                val total = body.contentLength()
                val buf = ByteArray(16384)
                var readTotal = 0L

                body.byteStream().use { input ->
                    FileOutputStream(apkFile).use { out ->
                        while (true) {
                            if (cancelled.get()) {
                                apkFile.delete()
                                return JSONObject().put("ok", false).put("error", "Cancelled").toString()
                            }
                            val n = input.read(buf)
                            if (n <= 0) break
                            out.write(buf, 0, n)
                            readTotal += n
                            val pct = if (total > 0) ((readTotal * 100L) / total).toInt().coerceIn(0, 100) else 0
                            val mb = String.format("%.1f MB", readTotal / (1024.0 * 1024.0))
                            onProgress(pct, "Downloading APK ($mb)…")
                        }
                    }
                }
            }

            onProgress(100, "Launching installer…")
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
            JSONObject().put("ok", true).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Update failed").toString()
        }
    }
}
