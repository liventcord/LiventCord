(()=>{var t={44675:t=>{var e,n,r=t.exports={};function i(){throw new Error("setTimeout has not been defined")}function u(){throw new Error("clearTimeout has not been defined")}!function(){try{e="function"==typeof setTimeout?setTimeout:i}catch(t){e=i}try{n="function"==typeof clearTimeout?clearTimeout:u}catch(t){n=u}}();function c(t){if(e===setTimeout)return setTimeout(t,0);if((e===i||!e)&&setTimeout){e=setTimeout;return setTimeout(t,0)}try{return e(t,0)}catch(n){try{return e.call(null,t,0)}catch(n){return e.call(this,t,0)}}}var o,s=[],l=!1,a=-1;function f(){if(l&&o){l=!1;o.length?s=o.concat(s):a=-1;s.length&&h()}}function h(){if(!l){var t=c(f);l=!0;for(var e=s.length;e;){o=s;s=[];for(;++a<e;)o&&o[a].run();a=-1;e=s.length}o=null;l=!1;!function(t){if(n===clearTimeout)return clearTimeout(t);if((n===u||!n)&&clearTimeout){n=clearTimeout;return clearTimeout(t)}try{return n(t)}catch(e){try{return n.call(null,t)}catch(e){return n.call(this,t)}}}(t)}}r.nextTick=function(t){
    var e=new Array(arguments.length-1);if(arguments.length>1)for(var n=1;n<arguments.length;n++)e[n-1]=arguments[n];s.push(new T(t,e));1!==s.length||l||c(h)};function T(t,e){this.fun=t;this.array=e}T.prototype.run=function(){this.fun.apply(null,this.array)};r.title="browser";r.browser=!0;r.env={};r.argv=[];r.version="";r.versions={};function E(){}r.on=E;r.addListener=E;r.once=E;r.off=E;r.removeListener=E;r.removeAllListeners=E;r.emit=E;r.prependListener=E;r.prependOnceListener=E;r.listeners=function(t){return[]};r.binding=function(t){throw new Error("process.binding is not supported")};r.cwd=function(){return"/"};r.chdir=function(t){throw new Error("process.chdir is not supported")};r.umask=function(){return 0}}},e={};function n(r){var i=e[r];if(void 0!==i)return i.exports;var u=e[r]={exports:{}};t[r](u,u.exports,n);return u.exports}(()=>{"use strict";var t,e,r,i,u,c,o,s,l,a=n(44675);({value:!0});window.GLOBAL_ENV={API_ENDPOINT:null!==(t="//discord.com/api")?t:"",
    API_VERSION:parseInt(null!=="9"?"9":"0"),WEBAPP_ENDPOINT:null!==(e="//discord.com")?e:"",CDN_HOST:null!==(r="cdn.discordapp.com")?r:"",RELEASE_CHANNEL:null!==(i="stable")?i:"",MARKETING_ENDPOINT:null!==(u="//discord.com")?u:"",MIGRATION_SOURCE_ORIGIN:null!==(c="https://discordapp.com")?c:"",MIGRATION_DESTINATION_ORIGIN:null!==(o="https://discord.com")?o:"",INVITE_HOST:null!==(s=a.env.INVITE_HOST)&&void 0!==s?s:"",GUILD_TEMPLATE_HOST:null!==(l=a.env.GUILD_TEMPLATE_HOST)&&void 0!==l?l:"",BRAINTREE_KEY:"",STRIPE_KEY:"",ADYEN_KEY:""};function f(){return window.pageUsesReact}!function(){var t=document.createElement("script");t.setAttribute("src",f()?"/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/index-react.js":"/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/index.js");t.async=!0;document.body.appendChild(t);if(f()){var e=document.createElement("link");e.setAttribute("rel","stylesheet")
    ;e.setAttribute("href","/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/styles.css");document.head.appendChild(e)}var n=document.createElement("script");n.setAttribute("src","/w/assets/5c6ef209aecf2721d4c8c8fbbdfa51481b04f3ed/styles.js");document.head.appendChild(n)}()})()})();
    //# sourceMappingURL=loader.js.map