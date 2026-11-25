package com.popcorntime.streambert

import android.content.Context
import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object HiAnimeResolver {

    private const val BASE_URL = "https://hianime.at"
    private const val USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    private val OBFUSCATION_KEY = "otaku-embed-v1".toByteArray(Charsets.UTF_8)
    private const val SERVER_NAME = "ZokoAnime"

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    data class StreamMeta(val referer: String, val origin: String, val userAgent: String)
    private val streamMetaMap = ConcurrentHashMap<String, StreamMeta>()

    fun rememberStreamMeta(url: String, referer: String, origin: String, ua: String) {
        if (streamMetaMap.size > 60) streamMetaMap.clear()
        streamMetaMap[url] = StreamMeta(referer, origin, ua)
    }

    fun getStreamMeta(url: String): StreamMeta? = streamMetaMap[url]

    // ── Local 127.0.0.1 HTTP proxy server ─────────────────────────────────────

    private var serverSocket: ServerSocket? = null
    private var serverPort: Int = 0
    private val serverToken: String = ByteArray(24).also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it) }
    private val executor = Executors.newCachedThreadPool()

    @Volatile private var currentVideoUrl: String = ""
    @Volatile private var currentVideoReferer: String = "$BASE_URL/"
    @Volatile private var currentVideoSubtitle: String? = null
    @Volatile private var currentVideoStartTime: Double = 0.0
    @Volatile private var hlsJsBytes: ByteArray? = null

    fun ensureProxyStarted(context: Context): Int {
        if (serverSocket != null && serverPort > 0) return serverPort
        synchronized(this) {
            if (serverSocket != null && serverPort > 0) return serverPort
            if (hlsJsBytes == null) {
                hlsJsBytes = context.assets.open("hls.min.js").use { it.readBytes() }
            }
            val ss = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
            serverSocket = ss
            serverPort = ss.localPort
            executor.submit {
                while (!ss.isClosed) {
                    try {
                        val sock = ss.accept()
                        executor.submit { handleClient(sock) }
                    } catch (_: Exception) {
                        if (ss.isClosed) break
                    }
                }
            }
            return serverPort
        }
    }

    fun setPlayerVideo(context: Context, argsJson: String): String {
        val args = JSONObject(argsJson)
        val url = args.optString("url")
        val referer = args.optString("referer").ifBlank { "$BASE_URL/" }
        val subtitle = args.optString("subtitle").ifBlank { null }
        val startTime = args.optDouble("startTime", 0.0).let { if (it.isFinite() && it >= 0) it else 0.0 }

        currentVideoUrl = url
        currentVideoReferer = referer
        currentVideoSubtitle = subtitle
        currentVideoStartTime = startTime

        val port = ensureProxyStarted(context)
        return JSONObject()
            .put("playerUrl", "http://127.0.0.1:$port/player?t=$serverToken")
            .toString()
    }

    fun buildExternalProxyUrl(context: Context, rawUrl: String, referer: String?): String {
        val port = ensureProxyStarted(context)
        if (!referer.isNullOrBlank()) currentVideoReferer = referer
        return "http://127.0.0.1:$port/proxy?t=$serverToken&url=${enc(rawUrl)}"
    }

    private fun handleClient(sock: Socket) {
        sock.use { s ->
            s.soTimeout = 20000
            val inp = BufferedInputStream(s.getInputStream())
            val out = BufferedOutputStream(s.getOutputStream())
            val headerBytes = ByteArrayOutputStream()
            var prev = 0
            var cur: Int
            var crlfCount = 0
            while (true) {
                cur = inp.read()
                if (cur == -1) return
                headerBytes.write(cur)
                if (headerBytes.size() > 16384) return
                if (prev == '\r'.code && cur == '\n'.code) {
                    crlfCount++
                    if (crlfCount == 2) break
                } else if (cur != '\r'.code) {
                    crlfCount = 0
                }
                prev = cur
            }
            val headerText = headerBytes.toString("UTF-8")
            val lines = headerText.split("\r\n")
            if (lines.isEmpty()) return
            val reqLine = lines[0].split(" ")
            if (reqLine.size < 2 || reqLine[0] != "GET") {
                writeSimple(out, 403, "text/plain", ByteArray(0))
                return
            }
            val headersMap = mutableMapOf<String, String>()
            for (l in lines.drop(1)) {
                val idx = l.indexOf(':')
                if (idx > 0) {
                    headersMap[l.substring(0, idx).trim().lowercase()] = l.substring(idx + 1).trim()
                }
            }
            val host = headersMap["host"] ?: ""
            if (host != "127.0.0.1:$serverPort") {
                writeSimple(out, 403, "text/plain", ByteArray(0))
                return
            }

            val fullPath = reqLine[1]
            val pathOnly = fullPath.substringBefore('?')
            val queryStr = fullPath.substringAfter('?', "")
            val params = parseQuery(queryStr)
            if (params["t"] != serverToken) {
                writeSimple(out, 403, "text/plain", ByteArray(0))
                return
            }

            when (pathOnly) {
                "/player" -> {
                    val html = buildPlayerHtml(currentVideoUrl, currentVideoStartTime, currentVideoSubtitle)
                    writeSimple(out, 200, "text/html; charset=utf-8", html.toByteArray(Charsets.UTF_8))
                }
                "/hls.js" -> {
                    val bytes = hlsJsBytes ?: ByteArray(0)
                    writeSimple(out, 200, "application/javascript", bytes)
                }
                "/proxy" -> {
                    val target = params["url"] ?: ""
                    if (!target.startsWith("http://") && !target.startsWith("https://")) {
                        writeSimple(out, 400, "text/plain", ByteArray(0))
                        return
                    }
                    proxyTarget(target, headersMap["range"], out)
                }
                else -> writeSimple(out, 404, "text/plain", ByteArray(0))
            }
        }
    }

    private fun proxyTarget(targetUrl: String, rangeHeader: String?, out: BufferedOutputStream) {
        try {
            val reqBuilder = Request.Builder()
                .url(targetUrl)
                .header("User-Agent", USER_AGENT)
                .header("Referer", currentVideoReferer)
                .header("Accept", "*/*")
                .header("Accept-Encoding", "identity")
            if (!rangeHeader.isNullOrBlank()) reqBuilder.header("Range", rangeHeader)

            client.newCall(reqBuilder.build()).execute().use { res ->
                val status = res.code
                val contentType = res.header("Content-Type") ?: "application/octet-stream"
                val isPlaylist = Regex("\\.m3u8(\\?|$)", RegexOption.IGNORE_CASE).containsMatchIn(targetUrl) ||
                    contentType.contains("mpegurl", ignoreCase = true)

                if (isPlaylist && status == 200) {
                    val text = res.body?.string() ?: ""
                    val rewritten = if (text.trimStart().startsWith("#EXTM3U")) {
                        rewritePlaylist(text, targetUrl)
                    } else text
                    writeSimple(out, 200, "application/vnd.apple.mpegurl", rewritten.toByteArray(Charsets.UTF_8))
                    return
                }

                val body = res.body
                val len = body?.contentLength() ?: -1L
                val sb = StringBuilder()
                sb.append("HTTP/1.1 $status OK\r\n")
                sb.append("Content-Type: $contentType\r\n")
                if (len >= 0) sb.append("Content-Length: $len\r\n")
                res.header("Content-Range")?.let { sb.append("Content-Range: $it\r\n") }
                res.header("Accept-Ranges")?.let { sb.append("Accept-Ranges: $it\r\n") }
                sb.append("Cache-Control: no-store\r\n")
                sb.append("Connection: close\r\n\r\n")
                out.write(sb.toString().toByteArray(Charsets.UTF_8))
                val stream = body?.byteStream()
                if (stream != null) {
                    val buf = ByteArray(16384)
                    while (true) {
                        val n = stream.read(buf)
                        if (n <= 0) break
                        out.write(buf, 0, n)
                    }
                }
                out.flush()
            }
        } catch (_: Exception) {
            try { writeSimple(out, 502, "text/plain", ByteArray(0)) } catch (_: Exception) {}
        }
    }

    private fun proxiedPath(u: String): String = "/proxy?t=$serverToken&url=${enc(u)}"

    private fun rewritePlaylist(text: String, playlistUrl: String): String {
        val base = URL(playlistUrl)
        fun abs(u: String): String = URL(base, u).toExternalForm()
        return text.split(Regex("\\r?\\n")).joinToString("\n") { line ->
            val t = line.trim()
            if (t.isEmpty()) line
            else if (t.startsWith("#")) {
                Regex("""URI="([^"]+)"""").replace(line) { m ->
                    """URI="${proxiedPath(abs(m.groupValues[1]))}""""
                }
            } else {
                proxiedPath(abs(t))
            }
        }
    }

    private fun buildPlayerHtml(videoUrl: String, startTime: Double, subtitleUrl: String?): String {
        val track = if (!subtitleUrl.isNullOrBlank()) {
            """<track kind="subtitles" src="${escHtml(proxiedPath(subtitleUrl))}" srclang="en" label="Subtitles" default>"""
        } else ""
        val srcJson = JSONObject.quote(proxiedPath(videoUrl))
        return """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;display:block}</style>
</head><body>
<video id="v" controls playsinline autoplay>$track</video>
<script src="/hls.js?t=$serverToken"></script>
<script>
  const video=document.getElementById('v');
  const src=$srcJson;
  const startTime=$startTime;
  if(window.Hls&&Hls.isSupported()){
    const hls=new Hls({autoStartLoad:false});
    hls.loadSource(src);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{
      hls.startLevel=hls.levels.length-1;
      hls.startLoad(startTime>0?startTime:-1);
      video.play().catch(()=>{});
    });
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=src;
    if(startTime>0)video.addEventListener('loadedmetadata',()=>{video.currentTime=startTime;},{once:true});
  }
</script>
</body></html>"""
    }

    private fun writeSimple(out: BufferedOutputStream, code: Int, mime: String, body: ByteArray) {
        val header = "HTTP/1.1 $code OK\r\n" +
            "Content-Type: $mime\r\n" +
            "Content-Length: ${body.size}\r\n" +
            "Cache-Control: no-store\r\n" +
            "Connection: close\r\n\r\n"
        out.write(header.toByteArray(Charsets.UTF_8))
        if (body.isNotEmpty()) out.write(body)
        out.flush()
    }

    private fun parseQuery(q: String): Map<String, String> {
        if (q.isEmpty()) return emptyMap()
        val map = mutableMapOf<String, String>()
        for (pair in q.split("&")) {
            val idx = pair.indexOf('=')
            if (idx > 0) {
                val k = URLDecoder.decode(pair.substring(0, idx), "UTF-8")
                val v = URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
                map[k] = v
            }
        }
        return map
    }

    // ── HiAnime Scraping & AniList lookup ─────────────────────────────────────

    fun resolveHiAnime(argsJson: String, onProgress: (String) -> Unit): String {
        return try {
            val args = JSONObject(argsJson)
            val title = args.optString("title").take(300)
            if (title.isBlank()) return JSONObject().put("ok", false).put("error", "Missing title").toString()
            val isMovie = args.optBoolean("isMovie", false)
            val season = args.optInt("seasonNumber", 1).coerceAtLeast(1)
            val epNum = args.optInt("episodeNumber", 1).coerceAtLeast(1)
            val mode = if (args.optString("translationType") == "dub") "dub" else "sub"

            onProgress("search")

            val ani = if (isMovie) {
                AnilistResult(title, null, null, null, null)
            } else {
                anilistSeasonTitle(title, season)
            }

            var searchTitle = ani.title
            var adjustedEp = epNum
            if (!isMovie && ani.episodes != null && epNum > ani.episodes && !ani.nextTitle.isNullOrBlank()) {
                adjustedEp = epNum - ani.episodes
                searchTitle = ani.nextTitle
            }

            val candidates = linkedSetOf(
                searchTitle,
                sanitizeTitle(searchTitle),
                if (searchTitle == ani.title) ani.romaji else null,
                if (searchTitle == ani.nextTitle) ani.nextRomaji else null,
                title,
                sanitizeTitle(title)
            ).filterNotNull().filter { it.isNotBlank() }

            val show = findShow(candidates)
                ?: return JSONObject().put("ok", false).put("error", "No results for: $searchTitle").toString()

            onProgress("episodes")
            val episodes = hianimeEpisodes(show.id)
            if (episodes.isEmpty()) {
                return JSONObject().put("ok", false).put("error", "No episodes found for: ${show.title}").toString()
            }
            val wanted = if (isMovie) "1" else adjustedEp.toString()
            val ep = episodes.firstOrNull { it.number == wanted }
                ?: episodes.firstOrNull { it.number.toDoubleOrNull() == wanted.toDoubleOrNull() }
                ?: (if (isMovie) episodes.firstOrNull() else null)
                ?: return JSONObject().put("ok", false).put("error", "Episode $wanted not found").toString()

            onProgress("stream")
            val stream = hianimeStream(ep.epId, mode)

            JSONObject().apply {
                put("ok", true)
                put("url", stream.masterUrl)
                put("resolution", "auto")
                put("sourceName", SERVER_NAME)
                put("isDirectMp4", false)
                put("referer", stream.referer)
                if (stream.subtitle != null) put("subtitle", stream.subtitle)
                if (stream.malId != null) put("malId", stream.malId)
                put("searchTitle", searchTitle)
                put("matchedTitle", show.title)
            }.toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", (e.message ?: "Error").take(200)).toString()
        }
    }

    private data class ShowHit(val id: String, val title: String, val jname: String?)
    private data class EpHit(val epId: String, val number: String)
    private data class StreamHit(val masterUrl: String, val referer: String, val malId: Int?, val subtitle: String?)
    private data class AnilistResult(
        val title: String,
        val romaji: String?,
        val episodes: Int?,
        val nextTitle: String?,
        val nextRomaji: String?
    )

    private fun curl(url: String, referer: String? = null, accept: String = "*/*"): String {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", accept)
            .header("Accept-Language", "en-US,en;q=0.9")
            .apply { if (!referer.isNullOrBlank()) header("Referer", referer) }
            .build()
        client.newCall(req).execute().use { res ->
            val body = res.body?.string() ?: ""
            if (Regex("<title>\\s*Just a moment", RegexOption.IGNORE_CASE).containsMatchIn(body)) {
                throw RuntimeException("Blocked by Cloudflare (HiAnime)")
            }
            if (!res.isSuccessful) throw RuntimeException("HTTP ${res.code} from $url")
            return body
        }
    }

    private fun findShow(candidates: List<String>): ShowHit? {
        val normSet = candidates.map { normalizeTitle(it) }.filter { it.isNotBlank() }.toSet()
        var fallback: ShowHit? = null
        val searchedNorms = mutableSetOf<String>()
        for (c in candidates) {
            val n = normalizeTitle(c)
            if (n.isBlank() || !searchedNorms.add(n)) continue
            val hits = try { hianimeSearch(c) } catch (e: Exception) {
                if ((e.message ?: "").contains("Cloudflare", ignoreCase = true)) throw e
                continue
            }
            if (hits.isEmpty()) continue
            val exact = hits.firstOrNull {
                normSet.contains(normalizeTitle(it.title)) ||
                    (it.jname != null && normSet.contains(normalizeTitle(it.jname)))
            }
            if (exact != null) return exact
            if (fallback == null) fallback = hits.first()
        }
        return fallback
    }

    private fun hianimeSearch(query: String): List<ShowHit> {
        val q = enc(query).replace("%20", "+")
        val html = curl("$BASE_URL/search?keyword=$q", accept = "text/html")
        val main = html.substringBefore("""id="main-sidebar"""")
        val out = mutableListOf<ShowHit>()
        val h3Regex = Regex("""<h3 class="film-name">([\s\S]*?)</h3>""")
        val anchorRegex = Regex("""<a\s+([^>]*)>""")
        for (m in h3Regex.findAll(main)) {
            val a = anchorRegex.find(m.groupValues[1]) ?: continue
            val attrs = a.groupValues[1]
            val href = getAttr(attrs, "href") ?: continue
            val title = getAttr(attrs, "title") ?: continue
            val id = href.substringBefore('?').trimEnd('/').substringAfterLast('/')
            if (id.isBlank()) continue
            val jname = getAttr(attrs, "data-jname")?.let { decodeEntities(it) }
            out.add(ShowHit(id, decodeEntities(title), jname))
        }
        return out
    }

    private fun hianimeEpisodes(showId: String): List<EpHit> {
        val numericId = showId.substringAfterLast('-')
        if (!Regex("^\\d+$").matches(numericId)) throw RuntimeException("Invalid show id")
        val body = curl("$BASE_URL/api/theme/episode/list/$numericId", referer = "$BASE_URL/")
        val html = unwrapApiHtml(body)
        val out = mutableListOf<EpHit>()
        for (chunk in html.split("ep-item").drop(1)) {
            val num = getAttr(chunk, "data-number") ?: continue
            val epId = getAttr(chunk, "data-id") ?: continue
            if (!Regex("^\\d+$").matches(epId)) continue
            if (!chunk.contains("/watch/$showId?ep=")) continue
            out.add(EpHit(epId, num))
        }
        return out
    }

    private fun hianimeStream(epId: String, mode: String): StreamHit {
        val body = curl("$BASE_URL/api/theme/episode/servers?episodeId=$epId", referer = "$BASE_URL/")
        val html = unwrapApiHtml(body)
        var hash: String? = null
        for (chunk in html.split("server-item").drop(1)) {
            if (getAttr(chunk, "data-type") == mode && getAttr(chunk, "data-server-name") == SERVER_NAME) {
                hash = getAttr(chunk, "data-hash")
                if (!hash.isNullOrBlank()) break
            }
        }
        if (hash.isNullOrBlank()) throw RuntimeException("No $SERVER_NAME server for $mode")
        val embedUrl = String(Base64.decode(hash, Base64.DEFAULT), Charsets.UTF_8).trim()
        if (!embedUrl.startsWith("http")) throw RuntimeException("Invalid embed url")
        val referer = Regex("^(https?://[^/]*).*$").replace(embedUrl, "$1/")
        val malId = Regex("/mal/(\\d+)/").find(embedUrl)?.groupValues?.get(1)?.toIntOrNull()

        val embedHtml = curl(embedUrl)
        val blob = Regex("""window\.__P="([^"]*)"""").find(embedHtml)?.groupValues?.get(1)
            ?: throw RuntimeException("Embed config not found")
        val jsonText = deobfuscateBlob(blob)

        var masterUrl: String? = null
        var subtitle: String? = null
        try {
            val cfg = JSONObject(jsonText)
            masterUrl = findM3u8InJson(cfg)
            val subs = cfg.optJSONArray("subtitles")
            if (subs != null) {
                for (i in 0 until subs.length()) {
                    val s = subs.optJSONObject(i)
                    if (s != null && s.optBoolean("default", false)) {
                        subtitle = s.optString("src").ifBlank { null }
                        break
                    }
                }
            }
        } catch (_: Exception) {
            masterUrl = Regex(""""src":"([^"]*\.m3u8[^"]*)"""").find(jsonText)?.groupValues?.get(1)
        }
        if (masterUrl.isNullOrBlank()) throw RuntimeException("No m3u8 source in embed config")
        return StreamHit(
            masterUrl.replace("\\/", "/"),
            referer,
            malId,
            subtitle?.replace("\\/", "/")
        )
    }

    private fun findM3u8InJson(v: Any?): String? {
        return when (v) {
            is String -> if (Regex("\\.m3u8", RegexOption.IGNORE_CASE).containsMatchIn(v)) v else null
            is JSONArray -> {
                for (i in 0 until v.length()) {
                    findM3u8InJson(v.opt(i))?.let { return it }
                }
                null
            }
            is JSONObject -> {
                val src = v.optString("src")
                if (src.isNotBlank() && Regex("\\.m3u8", RegexOption.IGNORE_CASE).containsMatchIn(src)) return src
                val keys = v.keys()
                while (keys.hasNext()) {
                    findM3u8InJson(v.opt(keys.next()))?.let { return it }
                }
                null
            }
            else -> null
        }
    }

    private fun anilistSeasonTitle(baseTitle: String, seasonNumber: Int): AnilistResult {
        val fallback = AnilistResult(baseTitle, null, null, null, null)
        return try {
            val query =
                """query(${'$'}search:String){Media(search:${'$'}search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}"""
            val payload = JSONObject().put("query", query).put("variables", JSONObject().put("search", baseTitle))
            val req = Request.Builder()
                .url("https://graphql.anilist.co/")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .header("Accept", "application/json")
                .build()
            client.newCall(req).execute().use { res ->
                val data = JSONObject(res.body?.string() ?: return fallback)
                val media = data.optJSONObject("data")?.optJSONObject("Media") ?: return fallback
                val titleObj = media.optJSONObject("title")
                val s1Eng = titleObj?.optString("english")?.ifBlank { null }
                val s1Rom = titleObj?.optString("romaji")?.ifBlank { null }
                val s1Eps = if (media.has("episodes") && !media.isNull("episodes")) media.optInt("episodes") else null

                val edges = media.optJSONObject("relations")?.optJSONArray("edges") ?: JSONArray()
                val sequels = mutableListOf<Pair<Int, JSONObject>>()
                for (i in 0 until edges.length()) {
                    val e = edges.optJSONObject(i) ?: continue
                    if (e.optString("relationType") != "SEQUEL") continue
                    val node = e.optJSONObject("node") ?: continue
                    if (node.optString("type") != "ANIME") continue
                    val fmt = node.optString("format")
                    if (fmt != "TV" && fmt != "TV_SHORT") continue
                    val yr = node.optJSONObject("startDate")?.optInt("year", 0)?.takeIf { it > 0 }
                        ?: node.optInt("seasonYear", 9999)
                    sequels.add(yr to node)
                }
                sequels.sortBy { it.first }
                fun nodeEng(n: JSONObject) = n.optJSONObject("title")?.let {
                    it.optString("english").ifBlank { it.optString("romaji").ifBlank { null } }
                }
                fun nodeRom(n: JSONObject) = n.optJSONObject("title")?.optString("romaji")?.ifBlank { null }

                if (seasonNumber <= 1) {
                    val next = sequels.firstOrNull()?.second
                    return AnilistResult(
                        s1Eng ?: baseTitle,
                        s1Rom,
                        s1Eps,
                        next?.let { nodeEng(it) },
                        next?.let { nodeRom(it) }
                    )
                }
                val target = sequels.getOrNull(seasonNumber - 2)?.second
                    ?: return fallback.copy(romaji = s1Rom)
                val next = sequels.getOrNull(seasonNumber - 1)?.second
                val tEps = if (target.has("episodes") && !target.isNull("episodes")) target.optInt("episodes") else null
                AnilistResult(
                    nodeEng(target) ?: baseTitle,
                    nodeRom(target) ?: s1Rom,
                    tEps,
                    next?.let { nodeEng(it) },
                    next?.let { nodeRom(it) }
                )
            }
        } catch (_: Exception) {
            fallback
        }
    }

    private fun deobfuscateBlob(blob: String): String {
        val buf = Base64.decode(blob, Base64.DEFAULT)
        val out = ByteArray(buf.size)
        for (i in buf.indices) {
            out[i] = (buf[i].toInt() xor OBFUSCATION_KEY[i % OBFUSCATION_KEY.size].toInt()).toByte()
        }
        return String(out, Charsets.UTF_8)
    }

    private fun unwrapApiHtml(body: String): String {
        var text = body
        try {
            val json = JSONObject(body)
            val sb = StringBuilder()
            fun walk(v: Any?) {
                when (v) {
                    is String -> sb.append(v).append('\n')
                    is JSONArray -> for (i in 0 until v.length()) walk(v.opt(i))
                    is JSONObject -> {
                        val keys = v.keys()
                        while (keys.hasNext()) walk(v.opt(keys.next()))
                    }
                }
            }
            walk(json)
            if (sb.isNotEmpty()) text = sb.toString()
        } catch (_: Exception) {}
        return text.replace("\\\"", "\"").replace("\\/", "/").replace("\\", "")
    }

    private fun getAttr(tag: String, name: String): String? =
        Regex("""$name="([^"]*)"""").find(tag)?.groupValues?.get(1)

    private fun decodeEntities(s: String): String = s
        .replace("&#039;", "'").replace("&#39;", "'")
        .replace("&quot;", "\"").replace("&lt;", "<")
        .replace("&gt;", ">").replace("&amp;", "&")

    private fun sanitizeTitle(t: String): String = t
        .replace(Regex("[''`´]"), "")
        .replace(Regex("[:!.]"), "")
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun normalizeTitle(t: String): String = t
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
    private fun escHtml(s: String): String = s
        .replace("&", "&amp;").replace("\"", "&quot;")
        .replace("<", "&lt;").replace(">", "&gt;")
}
