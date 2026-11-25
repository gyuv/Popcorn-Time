package com.popcorntime.streambert

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

object AdBlocker {

    private val EXACT_HOSTS = setOf(
        "www.google-analytics.com",
        "analytics.google.com",
        "googletagmanager.com",
        "www.googletagmanager.com",
        "googletagservices.com",
        "doubleclick.net",
        "adservice.google.com",
        "adservice.google.de",
        "pagead2.googlesyndication.com",
        "stats.g.doubleclick.net",
        "googleapis.com",
        "gstatic.com",
        "cdn.adx1.com",
        "intelligenceadx.com",
        "adsco.re",
        "mc.yandex.com",
        "mc.yandex.ru",
        "bvtpk.com",
        "my.rtmark.net",
        "b7510.com",
        "gt.unbrownunflat.com",
        "im.malocacomals.com",
        "users.videasy.net",
        "nf.sixmossin.com",
        "realizationnewestfangs.com",
        "acscdn.com",
        "lt.taloseempest.com",
        "pl26708123.profitableratecpm.com",
        "preferencenail.com",
        "protrafficinspector.com",
        "s10.histats.com",
        "weirdopt.com",
        "cloudflareinsights.com",
        "kettledroopingcontinuation.com",
        "wayfarerorthodox.com",
        "woxaglasuy.net",
        "adeptspiritual.com",
        "www.calculating-laugh.com",
        "amavhxdlofklxjg.xyz",
        "7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd",
        "5mq.get64t9vqg8pnbex1y463o.rest",
        "usrpubtrk.com",
        "adexchangeclear.com",
        "rzjzjnavztycv.online",
        "tmstr4.cloudnestra.com",
        "tmstr4.neonhorizonworkshops.com",
        "hameltnoummos.com",
        "ancillammmm.com",
        "hubeamily.com",
        "llvpn.com",
        "americanacademyofthermology.org",
        "d2pf0ys5xus6n.cloudfront.net",
        "gillyspencie.com",
        "soakysecrets.com",
        "mdstats.info",
        "ads-twitter.com",
        "connatix.com",
        "imasdk.googleapis.com",
        "jwpltx.com",
        "improving.duckduckgo.com",
        "openfpcdn.io",
        "phruk.org",
        "welcomingexpulsion.com",
        "pgo99.com",
        "todditehexarch.com",
        "uniolaicecaps.com",
        "alloha.tv",
        "pc.alloviewroll.com",
        "yadro.ru",
        "getaim.org",
        "myangular.life",
        "rstprgapipt.com",
        "veselchaga.link",
        "webvisor.org",
        "datariaarpent.com",
        "gamesrevenue.com",
        "73ed366d3137ec936bd60b1184467776.com",
        "shankedunwindy.cyou",
        "908df012d9bb72e6d26b41054588d758.com",
        "asemquips.cfd",
        "epicgameshubham.com",
        "tantrajoni.cfd",
        "thatdisform.cyou",
        "vdrk.site",
        "aarems.org",
        "aerionvel.com",
        "cdn4ads.com",
        "directyp.org",
        "fakerstoterframing.qpon",
        "karthliunstagy.com",
        "nresystems.com",
        "sainwertapr.com",
        "pxltag.com",
        "runative-syndicate.com",
        "saidairakas.com",
        "coiffesreal.qpon",
        "solarcyclonesky.com",
        "bawrelcuttail.com",
        "tabaxirethnize.cyou",
        "thyriswh.cyou",
        "ukankingwithea.com",
        "uuidksinc.net",
        "blockadsnot.com",
        "canseealltheugline.org",
        "eifitcannotke.org",
        "embercascademaple.com",
        "bancadeltempoidea.org",
        "1158060716.rsc.cdn77.org",
        "facebook.com",
        "tryedesign.com",
        "ahacdn.me",
        "autorepairworcester.com",
        "aelwynvel.com",
        "cometslourdy.cfd",
        "pusleybrand.cyou",
        "luugy.com",
        "nimbusgrovelodge.com",
        "brushetenglandagacant.qpon",
        "hyaloidsatury.com",
        "stummelbeelbow.com",
        "mgid.com",
        "deedwaifpleas.org",
        "pushaffiliate.net",
        "imp-mintads.site",
        "oceanicdreamcove.com",
        "xadsmart.com",
        "srvqk3.com",
        "1376341044.rsc.cdn77.org",
        "adright.xml-v4.ak-is2.net",
        "csp-reporting.cloudflare.com",
        "cysyjucymudity.com",
        "pncloudfl.com",
        "cruzswim.org",
        "darnobedienceupscale.com",
        "derricknationtop.com",
        "e89d45b16370ee7e43daeaf6ce8d9547.com",
        "tsyndicate.com",
        "rapidadexchange.com",
        "cepesbritons.qpon",
        "sarplerlacunes.qpon",
        "usrpubtrck.com",
        "ixiondartman.com",
        "varnishtala.cyou",
        "1037973644.rsc.cdn77.org",
        "cdn.pncloudfl.com.cdn.cloudflare.net",
        // Note: fonts.googleapis.com / fonts.gstatic.com kept out only if needed,
        // matching index.js BLOCKED_HOSTS:
        "fonts.googleapis.com",
        "fonts.gstatic.com"
    )

    private val WILDCARD_SUFFIXES = setOf(
        "doubleclick.net",
        "cloudflareinsights.com",
        "ancillammmm.com",
        "hubeamily.com",
        "soakysecrets.com",
        "ads-twitter.com",
        "connatix.com",
        "jwpltx.com",
        "todditehexarch.com",
        "uniolaicecaps.com",
        "alloha.tv",
        "yadro.ru",
        "getaim.org",
        "myangular.life",
        "rstprgapipt.com",
        "webvisor.org",
        "datariaarpent.com",
        "gamesrevenue.com",
        "shankedunwindy.cyou",
        "asemquips.cfd",
        "vdrk.site",
        "adsco.re",
        "aarems.org",
        "aerionvel.com",
        "cdn4ads.com",
        "directyp.org",
        "fakerstoterframing.qpon",
        "karthliunstagy.com",
        "nresystems.com",
        "sainwertapr.com",
        "tantrajoni.cfd",
        "thatdisform.cyou",
        "pxltag.com",
        "runative-syndicate.com",
        "saidairakas.com",
        "coiffesreal.qpon",
        "solarcyclonesky.com",
        "bawrelcuttail.com",
        "tabaxirethnize.cyou",
        "thyriswh.cyou",
        "ukankingwithea.com",
        "uuidksinc.net",
        "blockadsnot.com",
        "canseealltheugline.org",
        "eifitcannotke.org",
        "embercascademaple.com",
        "bancadeltempoidea.org",
        "tryedesign.com",
        "ahacdn.me",
        "aelwynvel.com",
        "cometslourdy.cfd",
        "pusleybrand.cyou",
        "luugy.com",
        "nimbusgrovelodge.com",
        "brushetenglandagacant.qpon",
        "hyaloidsatury.com",
        "google-analytics.com",
        "stummelbeelbow.com",
        "mgid.com",
        "deedwaifpleas.org",
        "pushaffiliate.net",
        "imp-mintads.site",
        "oceanicdreamcove.com",
        "xadsmart.com",
        "srvqk3.com",
        "facebook.com",
        "cysyjucymudity.com",
        "pncloudfl.com",
        "cruzswim.org",
        "darnobedienceupscale.com",
        "derricknationtop.com",
        "e89d45b16370ee7e43daeaf6ce8d9547.com",
        "tsyndicate.com",
        "rapidadexchange.com",
        "cepesbritons.qpon",
        "sarplerlacunes.qpon",
        "usrpubtrck.com",
        "ixiondartman.com",
        "varnishtala.cyou"
    )

    private val totalBlocked = AtomicLong(0)
    private val domainCounts = ConcurrentHashMap<String, Long>()
    private var initialized = false

    fun init(context: Context) {
        if (initialized) return
        initialized = true
        try {
            val prefs = context.getSharedPreferences("popcorntime_stats", Context.MODE_PRIVATE)
            val raw = prefs.getString("blockStats", null) ?: return
            val obj = JSONObject(raw)
            totalBlocked.set(obj.optLong("total", 0))
            val domains = obj.optJSONObject("domains")
            if (domains != null) {
                val keys = domains.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    domainCounts[k] = domains.optLong(k, 0)
                }
            }
        } catch (_: Exception) {}
    }

    fun persist(context: Context) {
        try {
            val obj = JSONObject()
            obj.put("total", totalBlocked.get())
            val d = JSONObject()
            for ((k, v) in domainCounts) {
                d.put(k, v)
            }
            obj.put("domains", d)
            context.getSharedPreferences("popcorntime_stats", Context.MODE_PRIVATE)
                .edit()
                .putString("blockStats", obj.toString())
                .apply()
        } catch (_: Exception) {}
    }

    fun isBlocked(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            val host = (uri.host ?: return false).lowercase()
            if (host == "yt3.ggpht.com" && (uri.path ?: "").startsWith("/ytc/")) {
                return true
            }
            if (EXACT_HOSTS.contains(host)) return true
            WILDCARD_SUFFIXES.any { suffix ->
                host == suffix || host.endsWith(".$suffix")
            }
        } catch (_: Exception) {
            false
        }
    }

    fun recordBlocked(context: Context, url: String): Pair<String, Long>? {
        return try {
            val host = (Uri.parse(url).host ?: return null).removePrefix("www.")
            totalBlocked.incrementAndGet()
            val count = (domainCounts[host] ?: 0L) + 1L
            domainCounts[host] = count
            if (totalBlocked.get() % 5L == 0L) persist(context)
            host to 1L
        } catch (_: Exception) {
            null
        }
    }

    fun getStatsJson(): String {
        val obj = JSONObject()
        obj.put("total", totalBlocked.get())
        val d = JSONObject()
        for ((k, v) in domainCounts) {
            d.put(k, v)
        }
        obj.put("domains", d)
        return obj.toString()
    }

    fun siteTweakCssForUrl(url: String): String? {
        val host = try {
            Uri.parse(url).host?.lowercase() ?: return null
        } catch (_: Exception) {
            return null
        }
        fun matches(domain: String) = host == domain || host.endsWith(".$domain")

        return when {
            matches("on.kinohub.vip") -> """
                html, body { overflow: hidden !important; background: #000 !important; }
                body * { visibility: hidden !important; }
                section.player_section, section.player_section * { visibility: visible !important; }
                section.player_section {
                  position: fixed !important; inset: 0 !important;
                  width: 100vw !important; height: 100vh !important;
                  max-width: none !important; margin: 0 !important;
                  z-index: 2147483647 !important; background: #000 !important; overflow: auto !important;
                }
            """.trimIndent()
            matches("aether.ist") -> """
                div:has(> .top-content), .top-content,
                [id="__overlayRouter::episodes"], [id="__overlayRouter::episodes"] + button,
                a.tabbable[class*="cancelHover"],
                button.tabbable.p-2.rounded-full:has(> span.text-xl > svg[width="18"][height="18"]) {
                  display: none !important;
                }
            """.trimIndent()
            matches("vidnest.fun") -> ".popup-selector, #overlay-id { display: none !important; }"
            matches("frembed.uno") -> ".popup-selector { display: none !important; }"
            else -> null
        }
    }

    fun extractSubtitleLang(url: String): String {
        return try {
            val u = Uri.parse(url)
            for (param in listOf("lang", "language", "locale", "sub", "l")) {
                val v = u.getQueryParameter(param)
                if (!v.isNullOrBlank() && v.length in 2..20) return v.lowercase()
            }
            val filename = (u.lastPathSegment ?: "")
            val m = Regex("[._-]([a-z]{2,3})[._-]?(vtt|srt|ass)?$", RegexOption.IGNORE_CASE).find(filename)
            if (m != null) return m.groupValues[1].lowercase()
            val segments = u.pathSegments ?: emptyList()
            for (seg in segments.dropLast(1)) {
                if (Regex("^[a-z]{2,3}(-[A-Z]{2})?$").matches(seg)) return seg.lowercase()
            }
            "unknown"
        } catch (_: Exception) {
            "unknown"
        }
    }
}
