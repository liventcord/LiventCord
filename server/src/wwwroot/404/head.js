/*! For license information please see head.d2a1877a9204d820794c.js.LICENSE.txt */
(() => {
  "use strict";
  var e = {
      6489: (e, a) => {
        (a.parse = function (e, a) {
          if ("string" !== typeof e)
            throw new TypeError("argument str must be a string");
          for (var n = {}, i = (a || {}).decode || o, t = 0; t < e.length; ) {
            var l = e.indexOf("=", t);
            if (-1 === l) break;
            var s = e.indexOf(";", t);
            if (-1 === s) s = e.length;
            else if (s < l) {
              t = e.lastIndexOf(";", l - 1) + 1;
              continue;
            }
            var c = e.slice(t, l).trim();
            if (void 0 === n[c]) {
              var d = e.slice(l + 1, s).trim();
              34 === d.charCodeAt(0) && (d = d.slice(1, -1)), (n[c] = r(d, i));
            }
            t = s + 1;
          }
          return n;
        }),
          (a.serialize = function (e, a, o) {
            var r = o || {},
              l = r.encode || t;
            if ("function" !== typeof l)
              throw new TypeError("option encode is invalid");
            if (!i.test(e)) throw new TypeError("argument name is invalid");
            var s = l(a);
            if (s && !i.test(s)) throw new TypeError("argument val is invalid");
            var c = e + "=" + s;
            if (null != r.maxAge) {
              var d = r.maxAge - 0;
              if (isNaN(d) || !isFinite(d))
                throw new TypeError("option maxAge is invalid");
              c += "; Max-Age=" + Math.floor(d);
            }
            if (r.domain) {
              if (!i.test(r.domain))
                throw new TypeError("option domain is invalid");
              c += "; Domain=" + r.domain;
            }
            if (r.path) {
              if (!i.test(r.path))
                throw new TypeError("option path is invalid");
              c += "; Path=" + r.path;
            }
            if (r.expires) {
              var m = r.expires;
              if (
                !(function (e) {
                  return "[object Date]" === n.call(e) || e instanceof Date;
                })(m) ||
                isNaN(m.valueOf())
              )
                throw new TypeError("option expires is invalid");
              c += "; Expires=" + m.toUTCString();
            }
            if (
              (r.httpOnly && (c += "; HttpOnly"),
              r.secure && (c += "; Secure"),
              r.priority)
            )
              switch (
                "string" === typeof r.priority
                  ? r.priority.toLowerCase()
                  : r.priority
              ) {
                case "low":
                  c += "; Priority=Low";
                  break;
                case "medium":
                  c += "; Priority=Medium";
                  break;
                case "high":
                  c += "; Priority=High";
                  break;
                default:
                  throw new TypeError("option priority is invalid");
              }
            if (r.sameSite)
              switch (
                "string" === typeof r.sameSite
                  ? r.sameSite.toLowerCase()
                  : r.sameSite
              ) {
                case !0:
                  c += "; SameSite=Strict";
                  break;
                case "lax":
                  c += "; SameSite=Lax";
                  break;
                case "strict":
                  c += "; SameSite=Strict";
                  break;
                case "none":
                  c += "; SameSite=None";
                  break;
                default:
                  throw new TypeError("option sameSite is invalid");
              }
            return c;
          });
        var n = Object.prototype.toString,
          i = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
        function o(e) {
          return -1 !== e.indexOf("%") ? decodeURIComponent(e) : e;
        }
        function t(e) {
          return encodeURIComponent(e);
        }
        function r(e, a) {
          try {
            return a(e);
          } catch (a) {
            return e;
          }
        }
      },
      3257: (e, a, n) => {
        Object.defineProperty(a, "__esModule", { value: !0 }),
          (a.initLocalizeJS = void 0),
          n(6489);
        const i = n(2717);
        a.initLocalizeJS = function () {
          let e = (0, i.getBrowserLanguage)(),
            a = (0, i.getLocalizerLanguage)(e)?.code || "en";
          ("en" !== a && "en-US" !== a) || (0, i.isStaging)()
            ? ((window.__skippedLocalizeInit = !1),
              window.Localize.on("widgetLoaded", function () {
                window.Localize.hideWidget();
              }),
              window.Localize.initialize({
                allowInlineBreakTags: !0,
                autodetectLanguage: !0,
                cdnBase: "cdn.localizeapi.com/api/lib/",
                blockedClasses: ["dont-translate"],
                blockedIds: ["onetrust-banner-sdk", "onetrust-consent-sdk"],
                disableWidget: !1,
                key: "XTwS61yOs521g",
                rememberLanguage: !0,
                translateNumbers: !0,
              }),
              (a =
                (0, i.getLocalizerLanguage)(e)?.code ||
                window.Localize.getLanguage() ||
                "en"),
              window.Localize.setLanguage(a))
            : ((window.__skippedLocalizeInit = !0),
              document.documentElement.classList.toggle("notranslate", !1),
              document
                .getElementsByTagName("head")[0]
                .querySelectorAll("style")
                .forEach((e) => {
                  e.innerHTML.includes("*{color:transparent!important") &&
                    (e.innerHTML = "");
                })),
            (0, i.setInitialBrowserLanguage)(a);
        };
      },
      2717: function (e, a, n) {
        var i =
          (this && this.__importDefault) ||
          function (e) {
            return e && e.__esModule ? e : { default: e };
          };
        Object.defineProperty(a, "__esModule", { value: !0 }),
          (a.getAvailableLanguages =
            a.setBrowserLanguage =
            a.setInitialBrowserLanguage =
            a.isStaging =
            a.setBrowserCookieLanguage =
            a.getLocalizerLanguage =
            a.getBrowserLanguage =
              void 0);
        const o = i(n(6489)),
          t = i(n(4080)),
          r = i(n(2866)),
          l = {},
          s = {},
          c = { code: "en-US", name: "English" };
        function d(e) {
          if (null != e && null != l[e]) {
            const a = l[e];
            document.cookie = `locale=${a};path=/`;
          }
        }
        function m() {
          return window.location.hostname?.includes("webflow.io");
        }
        function g() {
          let e = [];
          return (
            window.Localize.getAvailableLanguages(function (a, n) {
              a
                ? console.error(a)
                : (e = n.sort(function (e, a) {
                    return e.name.localeCompare(a.name);
                  }));
            }),
            Array.isArray(e) && 0 !== e.length ? e : r.default
          );
        }
        t.default.forEach((e) => {
          "string" === typeof e.localizeCode &&
            "string" === typeof e.code &&
            ((l[e.localizeCode] = e.code), (s[e.code] = e.localizeCode));
        }),
          (a.getBrowserLanguage = function () {
            return (
              o.default.parse(document.cookie).locale ||
              (function () {
                const { language: e } = window.navigator;
                return e;
              })()
            );
          }),
          (a.getLocalizerLanguage = function (e) {
            let a = g();
            const n = {};
            a.forEach((e) => {
              n[e.code] = e;
            });
            let i,
              o = e && null != s[e] ? s[e] : window.Localize.getLanguage();
            if ((null == o && (o = c.code), null != n[o])) return n[o];
            if (null == i && o.indexOf("-") > -1) {
              const e = o.split("-")[0];
              i = n[e];
            }
            return null == i ? c : i;
          }),
          (a.setBrowserCookieLanguage = d),
          (a.isStaging = m),
          (a.setInitialBrowserLanguage = function (e) {
            m() && window.Localize.setLanguage(e), d(e);
          }),
          (a.setBrowserLanguage = function (e) {
            window.Localize.setLanguage(e), d(e);
          }),
          (a.getAvailableLanguages = g);
      },
      2866: (e) => {
        e.exports = JSON.parse(
          '[{"code":"cs","name":"ÄŒeÅ¡tina"},{"code":"da","name":"Dansk"},{"code":"de","name":"Deutsch"},{"code":"en","name":"English"},{"code":"en-GB","name":"English (UK)"},{"code":"es","name":"EspaÃ±ol"},{"code":"es-LA","name":"EspaÃ±ol (AmÃ©rica Latina)"},{"code":"fr","name":"FranÃ§ais"},{"code":"hr","name":"Hrvatski"},{"code":"it","name":"Italiano"},{"code":"lt","name":"lietuviÅ³ kalba"},{"code":"hu","name":"Magyar"},{"code":"nl","name":"Nederlands"},{"code":"no","name":"Norsk"},{"code":"pl","name":"Polski"},{"code":"pt-BR","name":"PortuguÃªs (Brasil)"},{"code":"ro","name":"RomÃ¢nÄƒ"},{"code":"fi","name":"Suomi"},{"code":"sv","name":"Svenska"},{"code":"vi","name":"Tiáº¿ng Viá»‡t"},{"code":"tr","name":"TÃ¼rkÃ§e"},{"code":"el","name":"Î•Î»Î»Î·Î½Î¹ÎºÎ¬"},{"code":"bg","name":"Ð±ÑŠÐ»Ð³Ð°Ñ€ÑÐºÐ¸"},{"code":"ru","name":"Ð ÑƒÑÑÐºÐ¸Ð¹"},{"code":"uk","name":"Ð£ÐºÑ€Ð°Ñ—Ð½ÑÑŒÐºÐ°"},{"code":"hi","name":"à¤¹à¤¿à¤‚à¤¦à¥€"},{"code":"th","name":"à¹„à¸—à¸¢"},{"code":"ko","name":"í•œêµ­ì–´"},{"code":"zh-Hans","name":"ä¸­æ–‡"},{"code":"zh-TW","name":"ä¸­æ–‡(ç¹é«”)"},{"code":"ja","name":"æ—¥æœ¬èªž"}]',
        );
      },
      4080: (e) => {
        e.exports = JSON.parse(
          '[{"name":"English, USA","englishName":"English, USA","code":"en-US","localizeCode":"en"},{"name":"English, UK","englishName":"English, UK","code":"en-GB","localizeCode":"en-GB"},{"name":"ä¸­æ–‡","englishName":"Chinese Simplified","code":"zh-CN","localizeCode":"zh-Hans"},{"name":"ç¹é«”ä¸­æ–‡","englishName":"Traditional Chinese","code":"zh-TW","localizeCode":"zh-TW"},{"name":"ÄŒeÅ¡tina","englishName":"Czech","code":"cs","localizeCode":"cs"},{"name":"Dansk","englishName":"Danish","code":"da","localizeCode":"da"},{"name":"Nederlands","englishName":"Dutch","code":"nl","localizeCode":"nl"},{"name":"FranÃ§ais","englishName":"French","code":"fr","localizeCode":"fr"},{"name":"Deutsch","englishName":"German","code":"de","localizeCode":"de"},{"name":"Î•Î»Î»Î·Î½Î¹ÎºÎ¬","englishName":"Greek","code":"el","localizeCode":"el"},{"name":"Magyar","englishName":"Hungarian","code":"hu","localizeCode":"hu"},{"name":"Italiano","englishName":"Italian","code":"it","localizeCode":"it"},{"name":"æ—¥æœ¬èªž","englishName":"Japanese","code":"ja","localizeCode":"ja"},{"name":"í•œêµ­ì–´","englishName":"Korean","code":"ko","localizeCode":"ko"},{"name":"Norwegian","englishName":"Norwegian","code":"no","localizeCode":"no"},{"name":"Hrvatski","englishName":"Croatian","code":"hr","localizeCode":"hr"},{"name":"Polski","englishName":"Polish","code":"pl","localizeCode":"pl"},{"name":"PortuguÃªs do Brasil","englishName":"Portuguese, Brazilian","code":"pt-BR","localizeCode":"pt-BR"},{"name":"Ð ÑƒÑÑÐºÐ¸Ð¹","englishName":"Russian","code":"ru","localizeCode":"ru"},{"name":"EspaÃ±ol","englishName":"Spanish","code":"es-ES","localizeCode":"es"},{"name":"EspaÃ±ol (AmÃ©rica Latina)","englishName":"Spanish (Latin America)","code":"es-LA","localizeCode":"es-LA"},{"name":"Svenska","englishName":"Swedish","code":"sv-SE","localizeCode":"sv"},{"name":"TÃ¼rkÃ§e","englishName":"Turkish","code":"tr","localizeCode":"tr"},{"name":"Ð±ÑŠÐ»Ð³Ð°Ñ€ÑÐºÐ¸","englishName":"Bulgarian","code":"bg","localizeCode":"bg"},{"name":"Ð£ÐºÑ€Ð°Ñ—Ð½ÑÑŒÐºÐ°","englishName":"Ukrainian","code":"uk","localizeCode":"uk"},{"name":"Suomi","englishName":"Finnish","code":"fi","localizeCode":"fi"},{"name":"RomÃ¢nÄƒ","englishName":"Romanian","code":"ro","localizeCode":"ro"},{"name":"LietuviÅ¡kai","englishName":"Lithuanian","code":"lt","localizeCode":"lt"},{"name":"à¹„à¸—à¸¢","englishName":"Thai","code":"th","localizeCode":"th"},{"name":"Tiáº¿ng Viá»‡t","englishName":"Vietnamese","code":"vi","localizeCode":"vi"},{"name":"à¤¹à¤¿à¤‚à¤¦à¥€","englishName":"Hindi","code":"hi","localizeCode":"hi"}]',
        );
      },
    },
    a = {};
  (0,
  (function n(i) {
    var o = a[i];
    if (void 0 !== o) return o.exports;
    var t = (a[i] = { exports: {} });
    return e[i].call(t.exports, t, t.exports, n), t.exports;
  })(3257).initLocalizeJS)();
})();

const applink = "https://liventcord.github.io/LiventCord/app"

const setupButton = () => {
  const loginButton = document.querySelector(".nav_button-wrap");
  if (loginButton) {
    loginButton.setAttribute("href", applink)
    loginButton.addEventListener("click", (event) => {
      event.preventDefault()
      window.location.href = applink
    }, { once: true })
  } else {
    requestAnimationFrame(setupButton)
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupButton)
} else {
  setupButton()
}