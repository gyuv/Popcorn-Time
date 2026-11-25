package com.popcorntime.mobile

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var rootContainer: FrameLayout
    private lateinit var mainWebView: WebView
    private lateinit var playerWebView: WebView
    private lateinit var fullscreenContainer: FrameLayout
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val bgExecutor = Executors.newCachedThreadPool()

    private var playerVisible = false
    private var isFullscreen = false
    private var lastPlayerUrl = "about:blank"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AdBlocker.init(this)

        rootContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0A0A0A"))
        }
        setContentView(rootContainer)

        // Respect system bars / display cutouts during portrait browsing
        WindowCompat.setDecorFitsSystemWindows(window, true)
        showSystemBars()

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        mainWebView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0A0A0A"))
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
            }
            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest
                ): Boolean {
                    val u = request.url.toString()
                    if (u.startsWith("https://appassets.androidplatform.net/")) return false
                    openExternalUrl(u)
                    return true
                }
            }
            webChromeClient = WebChromeClient()
        }

        playerWebView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportMultipleWindows(false)
                javaScriptCanOpenWindowsAutomatically = false
            }
            webViewClient = PlayerWebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                    if (view == null) return
                    customView?.let { fullscreenContainer.removeView(it) }
                    customView = view
                    customViewCallback = callback
                    fullscreenContainer.addView(
                        view,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    fullscreenContainer.visibility = View.VISIBLE
                    applyFullscreenState(true)
                    emitToMain("webview-enter-fullscreen", "null")
                }

                override fun onHideCustomView() {
                    customView?.let { fullscreenContainer.removeView(it) }
                    customView = null
                    fullscreenContainer.visibility = View.GONE
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                    applyFullscreenState(false)
                    emitToMain("webview-leave-fullscreen", "null")
                }
            }
        }

        fullscreenContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
        }

        rootContainer.addView(
            mainWebView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        rootContainer.addView(
            playerWebView,
            FrameLayout.LayoutParams(0, 0)
        )
        rootContainer.addView(
            fullscreenContainer,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleMobileBack()
            }
        })

        mainWebView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        mainWebView.requestFocus()
    }

    private fun handleMobileBack() {
        if (customView != null) {
            playerWebView.webChromeClient?.onHideCustomView()
            mainWebView.evaluateJavascript(
                "(function(){ return !!(window.__handleTvBack && window.__handleTvBack()); })()",
                null
            )
            return
        }
        mainWebView.evaluateJavascript(
            "(function(){ return !!(window.__handleTvBack && window.__handleTvBack()); })()"
        ) { result ->
            if (result != "true") {
                mainHandler.post { moveTaskToBack(true) }
            }
        }
    }

    private fun applyFullscreenState(fullscreen: Boolean) {
        isFullscreen = fullscreen
        if (fullscreen) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            hideSystemBars()
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            showSystemBars()
        }
    }

    private inner class PlayerWebViewClient : WebViewClient() {
        override fun shouldInterceptRequest(
            view: WebView?,
            request: WebResourceRequest
        ): WebResourceResponse? {
            val url = request.url.toString()
            if (AdBlocker.isBlocked(url)) {
                val rec = AdBlocker.recordBlocked(this@MainActivity, url)
                if (rec != null) {
                    val batch = JSONObject()
                        .put("total", 1)
                        .put("domains", JSONObject().put(rec.first, 1))
                    emitToMain("blocked-stats-update", batch.toString())
                }
                return WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    204,
                    "No Content",
                    mapOf("Access-Control-Allow-Origin" to "*"),
                    ByteArrayInputStream(ByteArray(0))
                )
            }

            if (url.contains(".m3u8")) {
                val headers = request.requestHeaders ?: emptyMap()
                val ref = headers["Referer"] ?: headers["referer"] ?: ""
                val orig = headers["Origin"] ?: headers["origin"] ?: ""
                val ua = headers["User-Agent"] ?: headers["user-agent"] ?: ""
                HiAnimeResolver.rememberStreamMeta(url, ref, orig, ua)
                emitToMain("m3u8-found", JSONObject.quote(url))
            } else if (url.contains(".vtt")) {
                val lang = AdBlocker.extractSubtitleLang(url)
                val payload = JSONObject().put("url", url).put("lang", lang).toString()
                emitToMain("subtitle-found", payload)
            }
            return super.shouldInterceptRequest(view, request)
        }

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            if (url == "about:blank" || url.startsWith("http://127.0.0.1:")) return false
            return AdBlocker.isBlocked(url)
        }

        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            if (!url.isNullOrBlank() && url != "about:blank") {
                AdBlocker.siteTweakCssForUrl(url)?.let { css ->
                    val js = """
                        (function(){
                          var s = document.getElementById('__popcorntime_tweak') || document.createElement('style');
                          s.id = '__popcorntime_tweak';
                          s.textContent = ${JSONObject.quote(css)};
                          (document.head || document.documentElement).appendChild(s);
                        })();
                    """.trimIndent()
                    view?.evaluateJavascript(js, null)
                }
            }
            mainHandler.post {
                mainWebView.evaluateJavascript(
                    "window.__androidPlayerEvent && (window.__androidPlayerEvent('dom-ready',{}), window.__androidPlayerEvent('did-finish-load',{}));",
                    null
                )
            }
        }

        override fun onReceivedError(
            view: WebView?,
            errorCode: Int,
            description: String?,
            failingUrl: String?
        ) {
            super.onReceivedError(view, errorCode, description, failingUrl)
            mainHandler.post {
                mainWebView.evaluateJavascript(
                    "window.__androidPlayerEvent && window.__androidPlayerEvent('did-fail-load',{});",
                    null
                )
            }
        }
    }

    private val findVideoJs = """
        (function findVideo(root) {
          if (!root) return null;
          try {
            var direct = root.querySelectorAll ? root.querySelectorAll('video') : [];
            var best = null;
            for (var i = 0; i < direct.length; i++) {
              var c = direct[i];
              if (c && c.duration && isFinite(c.duration) && c.duration > 0) return c;
              if (!best) best = c;
            }
            if (best) return best;
            var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
            for (var j = 0; j < all.length; j++) {
              var el = all[j];
              if (el.shadowRoot) { var sv = findVideo(el.shadowRoot); if (sv) return sv; }
              if (el.tagName === 'IFRAME') {
                try { var fv = findVideo(el.contentDocument); if (fv) return fv; } catch(e) {}
              }
            }
          } catch(e) {}
          return null;
        })(document)
    """.trimIndent()

    private val mediaStopJs = """
        (function(){
          try {
            var clearDoc = function(doc) {
              if (!doc) return;
              var els = doc.querySelectorAll('video, audio');
              for (var i = 0; i < els.length; i++) {
                try {
                  els[i].pause();
                  els[i].muted = true;
                  els[i].removeAttribute('src');
                  els[i].srcObject = null;
                  els[i].load();
                } catch(e) {}
              }
              var frames = doc.querySelectorAll('iframe');
              for (var j = 0; j < frames.length; j++) {
                try { clearDoc(frames[j].contentDocument); } catch(e) {}
                try { frames[j].src = 'about:blank'; frames[j].remove(); } catch(e) {}
              }
            };
            clearDoc(document);
          } catch(e) {}
        })()
    """.trimIndent()

    private fun stopAndHidePlayer() {
        lastPlayerUrl = "about:blank"
        playerVisible = false
        if (customView != null) {
            try { playerWebView.webChromeClient?.onHideCustomView() } catch (_: Exception) {}
        }
        applyFullscreenState(false)
        try { playerWebView.evaluateJavascript(mediaStopJs, null) } catch (_: Exception) {}
        try { playerWebView.stopLoading() } catch (_: Exception) {}
        try { playerWebView.loadUrl("about:blank") } catch (_: Exception) {}
        try { playerWebView.clearHistory() } catch (_: Exception) {}
        try { playerWebView.onPause() } catch (_: Exception) {}
        playerWebView.visibility = View.GONE
        mainWebView.requestFocus()
    }

    private fun emitToMain(channel: String, payloadJson: String) {
        mainHandler.post {
            mainWebView.evaluateJavascript(
                "window.__androidEmit && window.__androidEmit(${JSONObject.quote(channel)}, $payloadJson);",
                null
            )
        }
    }

    private fun resolveMainAsync(callId: Int, ok: Boolean, resultJson: String) {
        mainHandler.post {
            mainWebView.evaluateJavascript(
                "window.__androidResolve && window.__androidResolve($callId, $ok, ${JSONObject.quote(resultJson)});",
                null
            )
        }
    }

    private fun openExternalUrl(url: String) {
        if (url.isBlank()) return
        try {
            val i = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(i)
        } catch (_: Exception) {}
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun showSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            show(WindowInsetsCompat.Type.systemBars())
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.requestApplyInsets(rootContainer)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && isFullscreen) hideSystemBars()
    }

    override fun onPause() {
        try { playerWebView.onPause() } catch (_: Exception) {}
        try { mainWebView.onPause() } catch (_: Exception) {}
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        try { mainWebView.onResume() } catch (_: Exception) {}
        if (playerVisible && lastPlayerUrl != "about:blank") {
            try { playerWebView.onResume() } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        stopAndHidePlayer()
        try { playerWebView.destroy() } catch (_: Exception) {}
        AdBlocker.persist(this)
        super.onDestroy()
    }

    inner class AndroidBridge {
        private val DEFAULT_TMDB_TOKEN =
            "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyOGM4ZGIwOTFiNzk5NjRmYzM4MGQ4NzRmNTU5NGU4NSIsIm5iZiI6MTc5NTQxNTA3NS4zNDA5OTk4LCJzdWIiOiI2YjAzZGMyM2Y1NzE3MzY1YTI1MTMyODMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.a317oAhtSgQ3eMZ36yl2Coxa4zebzEtv5A5ZrcTr7H0"

        @Volatile
        private var tokenClearedInSession = false

        private val prefs by lazy {
            getSharedPreferences("popcorntime_secure", Context.MODE_PRIVATE)
        }

        private fun tokenFiles(): List<File> {
            val list = mutableListOf(File(filesDir, "tmdb_token.txt"))
            getExternalFilesDir(null)?.let { list.add(File(it, "tmdb_token.txt")) }
            return list
        }

        private fun writeTokenFiles(token: String) {
            if (token.isBlank()) return
            for (f in tokenFiles()) {
                try {
                    f.parentFile?.mkdirs()
                    f.writeText(token, Charsets.UTF_8)
                } catch (_: Exception) {}
            }
        }

        private fun readTokenFromFiles(): String {
            for (f in tokenFiles()) {
                try {
                    if (f.exists()) {
                        val t = f.readText(Charsets.UTF_8).trim()
                        if (t.isNotEmpty()) return t
                    }
                } catch (_: Exception) {}
            }
            return ""
        }

        @JavascriptInterface
        fun getAppVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun getDeviceType(): String = "mobile"

        @JavascriptInterface
        fun setFullscreen(fullscreen: Boolean) {
            mainHandler.post { applyFullscreenState(fullscreen) }
        }

        @JavascriptInterface
        fun getCleanUserAgent(): String {
            return WebSettings.getDefaultUserAgent(this@MainActivity)
                .replace("; wv", "")
                .replace(Regex("\\s?Version/\\S+"), "")
                .trim()
        }

        @JavascriptInterface
        fun secureGet(key: String): String {
            val stored = prefs.getString(key, "") ?: ""
            if (stored.isNotEmpty()) return stored
            if (key == "apikey" && !tokenClearedInSession) {
                val recovered = readTokenFromFiles().ifBlank { DEFAULT_TMDB_TOKEN }
                prefs.edit().putString("apikey", recovered).commit()
                writeTokenFiles(recovered)
                return recovered
            }
            return ""
        }

        @JavascriptInterface
        fun secureSet(key: String, value: String) {
            if (value.isEmpty()) {
                if (key == "apikey") tokenClearedInSession = true
                prefs.edit().remove(key).commit()
            } else {
                if (key == "apikey") {
                    tokenClearedInSession = false
                    writeTokenFiles(value)
                }
                prefs.edit().putString(key, value).commit()
            }
        }

        @JavascriptInterface
        fun getSavedTokenBackup(): String {
            val stored = prefs.getString("apikey", "") ?: ""
            if (stored.isNotEmpty()) return stored
            return readTokenFromFiles().ifBlank { DEFAULT_TMDB_TOKEN }
        }

        @JavascriptInterface
        fun getBlockStats(): String = AdBlocker.getStatsJson()

        @JavascriptInterface
        fun openExternal(url: String) {
            mainHandler.post { openExternalUrl(url) }
        }

        @JavascriptInterface
        fun showKeyboard() {
            mainHandler.post {
                mainWebView.requestFocus()
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showSoftInput(mainWebView, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        @JavascriptInterface
        fun showKeyboardAt(cx: Int, cy: Int) {
            mainHandler.post {
                mainWebView.requestFocus()
                val now = SystemClock.uptimeMillis()
                val down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, cx.toFloat(), cy.toFloat(), 0)
                val up = MotionEvent.obtain(now, now + 30, MotionEvent.ACTION_UP, cx.toFloat(), cy.toFloat(), 0)
                mainWebView.dispatchTouchEvent(down)
                mainWebView.dispatchTouchEvent(up)
                down.recycle()
                up.recycle()
                mainHandler.postDelayed({
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                    imm.showSoftInput(mainWebView, InputMethodManager.SHOW_IMPLICIT)
                }, 80)
            }
        }

        @JavascriptInterface
        fun quitApp() {
            mainHandler.post { finish() }
        }

        @JavascriptInterface
        fun setPlayerBounds(x: Int, y: Int, w: Int, h: Int, visible: Boolean) {
            mainHandler.post {
                playerVisible = visible && w > 10 && h > 10
                if (playerVisible) {
                    val lp = FrameLayout.LayoutParams(w, h).apply {
                        leftMargin = x
                        topMargin = y
                    }
                    playerWebView.layoutParams = lp
                    if (playerWebView.visibility != View.VISIBLE) {
                        playerWebView.visibility = View.VISIBLE
                    }
                } else {
                    if (playerWebView.visibility != View.GONE) {
                        playerWebView.visibility = View.GONE
                    }
                }
            }
        }

        @JavascriptInterface
        fun loadPlayerUrl(url: String, userAgent: String) {
            mainHandler.post {
                val target = url.ifBlank { "about:blank" }
                if (target == "about:blank") {
                    stopAndHidePlayer()
                    return@post
                }
                if (target == lastPlayerUrl) return@post
                lastPlayerUrl = target
                val cleanDefault = getCleanUserAgent()
                playerWebView.settings.userAgentString = if (userAgent.isNotBlank()) userAgent else cleanDefault
                try { playerWebView.onResume() } catch (_: Exception) {}
                playerWebView.loadUrl(target)
            }
        }

        @JavascriptInterface
        fun playerStopped() {
            mainHandler.post {
                stopAndHidePlayer()
            }
        }

        @JavascriptInterface
        fun evalPlayerJs(callId: Int, code: String) {
            mainHandler.post {
                playerWebView.evaluateJavascript(code) { result ->
                    mainWebView.evaluateJavascript(
                        "window.__androidEvalResolve && window.__androidEvalResolve($callId, true, ${JSONObject.quote(result ?: "null")});",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun queryVideoProgress(callId: Int, _args: String) {
            mainHandler.post {
                val js = """
                    (function(){
                      var v = $findVideoJs;
                      if(!v || !v.duration || !isFinite(v.duration)) return null;
                      if(v.ended) return { currentTime: v.duration, duration: v.duration, ended: true };
                      if(v.paused) return null;
                      return { currentTime: v.currentTime, duration: v.duration, ended: false };
                    })()
                """.trimIndent()
                playerWebView.evaluateJavascript(js) { res ->
                    resolveMainAsync(callId, true, res ?: "null")
                }
            }
        }

        @JavascriptInterface
        fun resolveHiAnime(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val result = HiAnimeResolver.resolveHiAnime(argsJson) { stage ->
                    emitToMain("hianime-progress", JSONObject().put("stage", stage).toString())
                }
                resolveMainAsync(callId, true, result)
            }
        }

        @JavascriptInterface
        fun setPlayerVideo(callId: Int, argsJson: String) {
            bgExecutor.submit {
                try {
                    val result = HiAnimeResolver.setPlayerVideo(this@MainActivity, argsJson)
                    resolveMainAsync(callId, true, result)
                } catch (e: Exception) {
                    resolveMainAsync(callId, false, JSONObject().put("error", e.message).toString())
                }
            }
        }

        @JavascriptInterface
        fun openStreamExternal(callId: Int, argsJson: String) {
            bgExecutor.submit {
                try {
                    val args = JSONObject(argsJson)
                    val rawUrl = args.optString("url")
                    val title = args.optString("title", "Popcorn-Time")
                    val meta = HiAnimeResolver.getStreamMeta(rawUrl)
                    val playUrl = if (meta != null && meta.referer.isNotBlank()) {
                        HiAnimeResolver.buildExternalProxyUrl(this@MainActivity, rawUrl, meta.referer)
                    } else rawUrl

                    mainHandler.post {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(Uri.parse(playUrl), "video/*")
                                putExtra("title", title)
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(Intent.createChooser(intent, "Play with"))
                            resolveMainAsync(callId, true, JSONObject().put("ok", true).put("player", "external").toString())
                        } catch (e: Exception) {
                            resolveMainAsync(callId, true, JSONObject().put("ok", false).put("error", "No external video player found (install VLC or MX Player)").toString())
                        }
                    }
                } catch (e: Exception) {
                    resolveMainAsync(callId, true, JSONObject().put("ok", false).put("error", e.message).toString())
                }
            }
        }

        @JavascriptInterface
        fun searchSubtitles(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val res = SubtitleService.searchSubtitles(argsJson)
                resolveMainAsync(callId, true, res)
            }
        }

        @JavascriptInterface
        fun getSubtitleUrl(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val res = SubtitleService.getSubtitleUrl(argsJson)
                resolveMainAsync(callId, true, res)
            }
        }

        @JavascriptInterface
        fun wyzieValidateKey(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val key = JSONObject(argsJson).optString("key")
                val res = SubtitleService.validateWyzieKey(key)
                resolveMainAsync(callId, true, res)
            }
        }

        @JavascriptInterface
        fun fetchReleaseImage(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val url = JSONObject(argsJson).optString("url")
                val uri = SubtitleService.fetchReleaseImage(url)
                resolveMainAsync(callId, true, if (uri != null) JSONObject.quote(uri) else "null")
            }
        }

        @JavascriptInterface
        fun downloadAndInstallUpdate(callId: Int, argsJson: String) {
            bgExecutor.submit {
                val url = JSONObject(argsJson).optString("url")
                val res = UpdateManager.downloadAndInstallApk(this@MainActivity, url) { pct, label ->
                    val payload = JSONObject().put("percent", pct).put("label", label).toString()
                    emitToMain("update-progress", payload)
                }
                resolveMainAsync(callId, true, res)
            }
        }

        @JavascriptInterface
        fun cancelUpdate() {
            UpdateManager.cancel()
        }

        @JavascriptInterface
        fun getCacheSize(): Long {
            return dirSize(cacheDir)
        }

        @JavascriptInterface
        fun clearAppCache() {
            mainHandler.post {
                mainWebView.clearCache(true)
                playerWebView.clearCache(true)
                cacheDir.deleteRecursively()
            }
        }

        @JavascriptInterface
        fun resetApp() {
            mainHandler.post {
                prefs.edit().clear().apply()
                getSharedPreferences("popcorntime_stats", Context.MODE_PRIVATE).edit().clear().apply()
                mainWebView.clearCache(true)
                playerWebView.clearCache(true)
                mainWebView.reload()
            }
        }

        private fun dirSize(f: File): Long {
            if (!f.exists()) return 0L
            if (!f.isDirectory) return f.length()
            return f.listFiles()?.sumOf { dirSize(it) } ?: 0L
        }
    }
}
