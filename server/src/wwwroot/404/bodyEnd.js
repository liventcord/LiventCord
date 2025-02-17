/*! For license information please see bodyEnd.13163196036eebe16b6f.js.LICENSE.txt */
(() => {
  "use strict";
  var e = {
      6489: (e, n) => {
        (n.parse = function (e, n) {
          if ("string" !== typeof e)
            throw new TypeError("argument str must be a string");
          for (var a = {}, o = (n || {}).decode || i, t = 0; t < e.length; ) {
            var c = e.indexOf("=", t);
            if (-1 === c) break;
            var r = e.indexOf(";", t);
            if (-1 === r) r = e.length;
            else if (r < c) {
              t = e.lastIndexOf(";", c - 1) + 1;
              continue;
            }
            var d = e.slice(t, c).trim();
            if (void 0 === a[d]) {
              var s = e.slice(c + 1, r).trim();
              34 === s.charCodeAt(0) && (s = s.slice(1, -1)), (a[d] = l(s, o));
            }
            t = r + 1;
          }
          return a;
        }),
          (n.serialize = function (e, n, i) {
            var l = i || {},
              c = l.encode || t;
            if ("function" !== typeof c)
              throw new TypeError("option encode is invalid");
            if (!o.test(e)) throw new TypeError("argument name is invalid");
            var r = c(n);
            if (r && !o.test(r)) throw new TypeError("argument val is invalid");
            var d = e + "=" + r;
            if (null != l.maxAge) {
              var s = l.maxAge - 0;
              if (isNaN(s) || !isFinite(s))
                throw new TypeError("option maxAge is invalid");
              d += "; Max-Age=" + Math.floor(s);
            }
            if (l.domain) {
              if (!o.test(l.domain))
                throw new TypeError("option domain is invalid");
              d += "; Domain=" + l.domain;
            }
            if (l.path) {
              if (!o.test(l.path))
                throw new TypeError("option path is invalid");
              d += "; Path=" + l.path;
            }
            if (l.expires) {
              var u = l.expires;
              if (
                !(function (e) {
                  return "[object Date]" === a.call(e) || e instanceof Date;
                })(u) ||
                isNaN(u.valueOf())
              )
                throw new TypeError("option expires is invalid");
              d += "; Expires=" + u.toUTCString();
            }
            if (
              (l.httpOnly && (d += "; HttpOnly"),
              l.secure && (d += "; Secure"),
              l.priority)
            )
              switch (
                "string" === typeof l.priority
                  ? l.priority.toLowerCase()
                  : l.priority
              ) {
                case "low":
                  d += "; Priority=Low";
                  break;
                case "medium":
                  d += "; Priority=Medium";
                  break;
                case "high":
                  d += "; Priority=High";
                  break;
                default:
                  throw new TypeError("option priority is invalid");
              }
            if (l.sameSite)
              switch (
                "string" === typeof l.sameSite
                  ? l.sameSite.toLowerCase()
                  : l.sameSite
              ) {
                case !0:
                  d += "; SameSite=Strict";
                  break;
                case "lax":
                  d += "; SameSite=Lax";
                  break;
                case "strict":
                  d += "; SameSite=Strict";
                  break;
                case "none":
                  d += "; SameSite=None";
                  break;
                default:
                  throw new TypeError("option sameSite is invalid");
              }
            return d;
          });
        var a = Object.prototype.toString,
          o = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
        function i(e) {
          return -1 !== e.indexOf("%") ? decodeURIComponent(e) : e;
        }
        function t(e) {
          return encodeURIComponent(e);
        }
        function l(e, n) {
          try {
            return n(e);
          } catch (n) {
            return e;
          }
        }
      },
      8596: (e, n, a) => {
        Object.defineProperty(n, "__esModule", { value: !0 }),
          (n.initLanguageSelect =
            n.hideLocalizer =
            n.updateSelectedLanguage =
              void 0);
        const o = a(3257),
          i = a(2717),
          t = a(2717);
        function l(e) {
          return `<div class="dropdown-item" tabindex="0" role="button">\n      <div class="dropdown-clickable">\n        <div class="locale-container" data-locale="${e.code}">\n          <img class="flag flag-${e.code}"/>\n          <div class="dropdown-language-name">${e.name}</div>\n        </div>\n      </div>\n    </div>`;
        }
        function c() {
          const e = (0, t.getLocalizerLanguage)();
          if (null == e) return;
          let n = document.querySelector(".lang-selector-container .flag");
          n &&
            (n.classList.remove(...n.classList),
            n.classList.add("flag", "flag-" + e.code));
          let a = document.querySelector(
            ".lang-selector-container .selector-language-name",
          );
          a && (a.innerHTML = e.name);
        }
        function r() {
          let e = document.getElementById("locale-dropdown");
          e && (e.style.display = "none");
        }
        function d() {
          let e = document.getElementById("locale-dropdown");
          e && (e.style.display = "block");
        }
        (n.updateSelectedLanguage = c),
          (n.hideLocalizer = r),
          (n.initLanguageSelect = function () {
            const e = (0, i.getAvailableLanguages)();
            c(),
              (function (e) {
                if (e) {
                  let n = document.querySelector(
                    ".language .lang-dropdown-container .lang-dropdown",
                  );
                  n && (n.innerHTML = e.map(l).join(""));
                }
              })(e),
              document.addEventListener("click", (e) => {
                let n = document.getElementsByClassName("language")[0];
                n && !n.contains(e.target) && r();
              }),
              window.Localize.hideWidget(),
              (function () {
                let e = document.querySelectorAll(
                  ".language .lang-container .dropdown-item",
                );
                e &&
                  e.forEach(function (e) {
                    e.addEventListener("click", function (n) {
                      let a = e.querySelector(".locale-container");
                      if (a) {
                        let e = a.dataset.locale;
                        (0, i.setBrowserCookieLanguage)(e),
                          window.__skippedLocalizeInit &&
                            (0, o.initLocalizeJS)(),
                          (0, t.setBrowserLanguage)(e),
                          r(),
                          (0, i.getAvailableLanguages)(),
                          c();
                      }
                    }),
                      e.addEventListener("keyup", function (n) {
                        n.preventDefault(),
                          "Enter" === n.code &&
                            e instanceof HTMLElement &&
                            e.click();
                      });
                  }),
                  document.addEventListener("keyup", function (e) {
                    if ("Escape" === e.code) {
                      const e = document.getElementById("locale-dropdown");
                      e &&
                        "block" === window.getComputedStyle(e, null).display &&
                        r();
                    }
                  });
              })(),
              (function () {
                let e = document.querySelectorAll(
                  ".language .lang-container .lang-selector-container",
                );
                e &&
                  e.forEach(function (e) {
                    e.addEventListener("click", d);
                  });
              })();
          });
      },
      3257: (e, n, a) => {
        Object.defineProperty(n, "__esModule", { value: !0 }),
          (n.initLocalizeJS = void 0),
          a(6489);
        const o = a(2717);
        n.initLocalizeJS = function () {
          let e = (0, o.getBrowserLanguage)(),
            n = (0, o.getLocalizerLanguage)(e)?.code || "en";
          ("en" !== n && "en-US" !== n) || (0, o.isStaging)()
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
              (n =
                (0, o.getLocalizerLanguage)(e)?.code ||
                window.Localize.getLanguage() ||
                "en"),
              window.Localize.setLanguage(n))
            : ((window.__skippedLocalizeInit = !0),
              document.documentElement.classList.toggle("notranslate", !1),
              document
                .getElementsByTagName("head")[0]
                .querySelectorAll("style")
                .forEach((e) => {
                  e.innerHTML.includes("*{color:transparent!important") &&
                    (e.innerHTML = "");
                })),
            (0, o.setInitialBrowserLanguage)(n);
        };
      },
      2717: function (e, n, a) {
        var o =
          (this && this.__importDefault) ||
          function (e) {
            return e && e.__esModule ? e : { default: e };
          };
        Object.defineProperty(n, "__esModule", { value: !0 }),
          (n.getAvailableLanguages =
            n.setBrowserLanguage =
            n.setInitialBrowserLanguage =
            n.isStaging =
            n.setBrowserCookieLanguage =
            n.getLocalizerLanguage =
            n.getBrowserLanguage =
              void 0);
        const i = o(a(6489)),
          t = o(a(4080)),
          l = o(a(2866)),
          c = {},
          r = {},
          d = { code: "en-US", name: "English" };
        function s(e) {
          if (null != e && null != c[e]) {
            const n = c[e];
            document.cookie = `locale=${n};path=/`;
          }
        }
        function u() {
          return window.location.hostname?.includes("webflow.io");
        }
        function g() {
          let e = [];
          return (
            window.Localize.getAvailableLanguages(function (n, a) {
              n
                ? console.error(n)
                : (e = a.sort(function (e, n) {
                    return e.name.localeCompare(n.name);
                  }));
            }),
            Array.isArray(e) && 0 !== e.length ? e : l.default
          );
        }
        t.default.forEach((e) => {
          "string" === typeof e.localizeCode &&
            "string" === typeof e.code &&
            ((c[e.localizeCode] = e.code), (r[e.code] = e.localizeCode));
        }),
          (n.getBrowserLanguage = function () {
            return (
              i.default.parse(document.cookie).locale ||
              (function () {
                const { language: e } = window.navigator;
                return e;
              })()
            );
          }),
          (n.getLocalizerLanguage = function (e) {
            let n = g();
            const a = {};
            n.forEach((e) => {
              a[e.code] = e;
            });
            let o,
              i = e && null != r[e] ? r[e] : window.Localize.getLanguage();
            if ((null == i && (i = d.code), null != a[i])) return a[i];
            if (null == o && i.indexOf("-") > -1) {
              const e = i.split("-")[0];
              o = a[e];
            }
            return null == o ? d : o;
          }),
          (n.setBrowserCookieLanguage = s),
          (n.isStaging = u),
          (n.setInitialBrowserLanguage = function (e) {
            u() && window.Localize.setLanguage(e), s(e);
          }),
          (n.setBrowserLanguage = function (e) {
            window.Localize.setLanguage(e), s(e);
          }),
          (n.getAvailableLanguages = g);
      },
      638: (e, n) => {
        Object.defineProperty(n, "__esModule", { value: !0 }),
          (n.setupDownloads =
            n.handleExternalDownloadClick =
            n.downloadFile =
              void 0),
          (n.downloadFile = async (e, n) => {
            const a = await fetch(e),
              o = await a.blob(),
              i = document.createElement("a");
            (i.href = URL.createObjectURL(o)),
              i.setAttribute("download", n),
              i.click();
          }),
          (n.handleExternalDownloadClick = (e) => async (a) => {
            a.preventDefault();
            const o = a.currentTarget.href;
            try {
              await (0, n.downloadFile)(o, e);
            } catch (a) {
              console.error("Could not automatically download", a),
                window.open(o, "_blank");
            }
          }),
          (n.setupDownloads = () => {
            document.querySelectorAll("[data-download-file]").forEach((e) => {
              const a = e;
              a.addEventListener(
                "click",
                (0, n.handleExternalDownloadClick)(
                  a.dataset.downloadFile ?? "untitled",
                ),
              );
            });
          });
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
    n = {};
  function a(o) {
    var i = n[o];
    if (void 0 !== i) return i.exports;
    var t = (n[o] = { exports: {} });
    return e[o].call(t.exports, t, t.exports, a), t.exports;
  }
  (() => {
    const e = a(638),
      n = a(8596),
      o = () => {
        (0, n.initLanguageSelect)(), window.Localize.off("setLanguage", o);
      };
    "source" === window.Localize.getLanguage()
      ? window.Localize.on("setLanguage", o)
      : (0, n.initLanguageSelect)(),
      (0, e.setupDownloads)();
  })();
})();
