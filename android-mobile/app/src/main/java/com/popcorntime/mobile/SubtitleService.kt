package com.popcorntime.mobile

import android.util.Base64
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

object SubtitleService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun searchSubtitles(argsJson: String): String {
        val args = JSONObject(argsJson)
        val tmdbId = args.optString("tmdbId")
        val mediaType = args.optString("mediaType", "movie")
        val season = if (args.has("season") && !args.isNull("season")) args.optString("season") else null
        val episode = if (args.has("episode") && !args.isNull("episode")) args.optString("episode") else null
        val languages = args.optString("languages", "")
        val subdlKey = args.optString("subdlApiKey", "")
        val wyzieKey = args.optString("wyzieApiKey", "")

        val errors = mutableListOf<String>()
        if (subdlKey.isNotBlank()) {
            val r = searchSubDL(tmdbId, mediaType, season, episode, languages, subdlKey)
            if (r.optBoolean("ok")) return r.toString()
            errors.add(r.optString("error"))
        }
        val w = searchWyzie(tmdbId, mediaType, season, episode, languages, wyzieKey)
        if (w.optBoolean("ok")) return w.toString()
        errors.add(w.optString("error"))

        return JSONObject().apply {
            put("ok", false)
            put(
                "error",
                errors.filter { it.isNotBlank() }.joinToString(" · ")
                    .ifBlank { "No subtitles found." }
            )
        }.toString()
    }

    private fun searchSubDL(
        tmdbId: String,
        mediaType: String,
        season: String?,
        episode: String?,
        languages: String,
        apiKey: String
    ): JSONObject {
        return try {
            val sb = StringBuilder("https://api.subdl.com/api/v1/subtitles?")
            sb.append("api_key=").append(enc(apiKey))
            sb.append("&tmdb_id=").append(enc(tmdbId))
            sb.append("&type=").append(if (mediaType == "tv") "tv" else "movie")
            sb.append("&subs_per_page=30")
            if (mediaType == "tv" && !season.isNullOrBlank()) sb.append("&season_number=").append(enc(season))
            if (mediaType == "tv" && !episode.isNullOrBlank()) sb.append("&episode_number=").append(enc(episode))
            if (languages.isNotBlank()) {
                sb.append("&languages=").append(enc(languages.split("-")[0].uppercase()))
            }

            val req = Request.Builder().url(sb.toString()).header("User-Agent", "Streambert").build()
            client.newCall(req).execute().use { res ->
                val body = res.body?.string() ?: ""
                if (!res.isSuccessful) {
                    return JSONObject().put("ok", false).put("error", "SubDL error ${res.code}")
                }
                val data = JSONObject(body)
                if (!data.optBoolean("status", false)) {
                    return JSONObject().put("ok", false).put("error", "SubDL returned no results")
                }
                val arr = data.optJSONArray("subtitles") ?: JSONArray()
                val results = JSONArray()
                for (i in 0 until arr.length()) {
                    val s = arr.getJSONObject(i)
                    val url = s.optString("url")
                    val name = s.optString("name").ifBlank { s.optString("release_name") }
                    results.put(JSONObject().apply {
                        put("file_id", "subdl_${s.optString("sd_id")}_${enc(url)}")
                        put("file_name", name)
                        put("language", s.optString("lang").lowercase())
                        put("release", s.optString("release_name").ifBlank { name })
                        put("uploader", s.optString("author").ifBlank { "SubDL" })
                        put("download_count", s.optInt("downloads", 0))
                        put("hearing_impaired", s.optBoolean("hi", false))
                        put("ai_translated", false)
                        put("machine_translated", false)
                        put("ratings", 0)
                        put("from_trusted", false)
                        put("via_subdl", true)
                    })
                }
                if (results.length() == 0) {
                    JSONObject().put("ok", false).put("error", "SubDL: no results")
                } else {
                    JSONObject().put("ok", true).put("results", results).put("via_subdl", true)
                }
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "SubDL failed")
        }
    }

    private fun searchWyzie(
        tmdbId: String,
        mediaType: String,
        season: String?,
        episode: String?,
        languages: String,
        apiKey: String
    ): JSONObject {
        return try {
            val base = if (apiKey.isNotBlank()) "https://sub.wyzie.io/search" else "https://subs.wyzie.ru/search"
            val sb = StringBuilder("$base?id=${enc(tmdbId)}&format=srt")
            if (languages.isNotBlank()) sb.append("&language=").append(enc(languages))
            if (mediaType == "tv" && !season.isNullOrBlank()) sb.append("&season=").append(enc(season))
            if (mediaType == "tv" && !episode.isNullOrBlank()) sb.append("&episode=").append(enc(episode))
            if (apiKey.isNotBlank()) sb.append("&key=").append(enc(apiKey))

            val req = Request.Builder().url(sb.toString()).build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) {
                    return JSONObject().apply {
                        put("ok", false)
                        put("error", "Wyzie error ${res.code}")
                        if (res.code == 401 || res.code == 403) put("wyzie_auth_error", true)
                    }
                }
                val arr = JSONArray(res.body?.string() ?: "[]")
                val results = JSONArray()
                for (i in 0 until arr.length()) {
                    val r = arr.getJSONObject(i)
                    val rawUrl = r.optString("url")
                    if (rawUrl.isBlank()) continue
                    val fullUrl = if (rawUrl.startsWith("http")) rawUrl
                    else "https://subs.wyzie.ru${if (rawUrl.startsWith("/")) "" else "/"}$rawUrl"
                    val displayName = listOf(
                        r.optString("display_name"),
                        r.optString("name"),
                        r.optString("release_name"),
                        r.optString("title"),
                        r.optString("SubFileName"),
                        r.optString("fileName")
                    ).firstOrNull { it.isNotBlank() }
                        ?: "${r.optString("language").uppercase()} subtitle #${i + 1}"

                    results.put(JSONObject().apply {
                        put("file_id", "wyzie_${i}_${enc(fullUrl)}")
                        put("direct_url", fullUrl)
                        put("file_name", displayName)
                        put("language", r.optString("language"))
                        put("release", displayName)
                        put("uploader", "Wyzie")
                        put("download_count", 0)
                        put("hearing_impaired", r.optBoolean("isHearingImpaired", false))
                        put("ai_translated", r.optBoolean("isAiTranslated", false))
                        put("machine_translated", false)
                        put("ratings", 0)
                        put("from_trusted", false)
                        put("via_wyzie", true)
                        put("original_source", r.optString("source"))
                    })
                }
                if (results.length() == 0) {
                    JSONObject().put("ok", false).put("error", "Wyzie: no results")
                } else {
                    JSONObject().put("ok", true).put("results", results).put("via_wyzie", true)
                }
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Wyzie failed")
        }
    }

    fun getSubtitleUrl(argsJson: String): String {
        return try {
            val fileId = JSONObject(argsJson).optString("fileId")
            if (fileId.startsWith("wyzie_")) {
                val url = URLDecoder.decode(fileId.split("_", limit = 3).getOrNull(2) ?: "", "UTF-8")
                return JSONObject().put("ok", true).put("url", url).toString()
            }
            if (fileId.startsWith("subdl_")) {
                val path = URLDecoder.decode(fileId.split("_", limit = 3).getOrNull(2) ?: "", "UTF-8")
                val dlUrl = "https://dl.subdl.com$path"
                val req = Request.Builder().url(dlUrl).header("User-Agent", "Streambert").build()
                client.newCall(req).execute().use { res ->
                    if (!res.isSuccessful) {
                        return JSONObject().put("ok", false).put("error", "SubDL HTTP ${res.code}").toString()
                    }
                    val bytes = res.body?.bytes() ?: ByteArray(0)
                    ZipInputStream(ByteArrayInputStream(bytes)).use { zis ->
                        var entry = zis.nextEntry
                        while (entry != null) {
                            val name = entry.name.substringAfterLast('/')
                            val ext = name.substringAfterLast('.', "").lowercase()
                            if (!entry.isDirectory && ext in setOf("srt", "vtt", "ass", "ssa")) {
                                val data = zis.readBytes()
                                val mime = if (ext == "vtt") "text/vtt" else "text/plain"
                                val b64 = Base64.encodeToString(data, Base64.NO_WRAP)
                                return JSONObject().apply {
                                    put("ok", true)
                                    put("url", "data:$mime;base64,$b64")
                                    put("file_name", name)
                                }.toString()
                            }
                            entry = zis.nextEntry
                        }
                    }
                    return JSONObject().put("ok", false).put("error", "No subtitle in ZIP").toString()
                }
            }
            JSONObject().put("ok", false).put("error", "Unknown subtitle ID").toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Failed").toString()
        }
    }

    fun validateWyzieKey(key: String): String {
        return try {
            val req = Request.Builder()
                .url("https://sub.wyzie.io/search?id=550&key=${enc(key.trim())}")
                .build()
            client.newCall(req).execute().use { res ->
                when {
                    res.isSuccessful -> JSONObject().put("ok", true).toString()
                    res.code == 401 || res.code == 403 ->
                        JSONObject().put("ok", false).put("error", "Invalid or expired Wyzie key").toString()
                    else -> JSONObject().put("ok", false).put("error", "Wyzie error ${res.code}").toString()
                }
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Validation failed").toString()
        }
    }

    fun fetchReleaseImage(url: String): String? {
        return try {
            val req = Request.Builder().url(url).build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return null
                val bytes = res.body?.bytes() ?: return null
                if (bytes.size > 4 * 1024 * 1024) return null
                val mime = res.header("Content-Type") ?: "image/png"
                "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
}
