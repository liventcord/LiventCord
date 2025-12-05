import { defineConfig } from "@farmfe/core";
import farmJsPluginVue from "@farmfe/js-plugin-vue";
import vue from "@farmfe/js-plugin-vue";
import eslint from "vite-plugin-eslint";
import { VitePWA } from "vite-plugin-pwa";

const isDev = process.env.FARM_ENV === "development";
const proxyTarget = "http://127.0.0.1:5005";
const proxyPaths = ["/api", "/profiles", "/guilds", "/attachments", "/auth"];

const proxyConfig = proxyPaths.reduce(
  (acc, path) => {
    acc[path] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: false
    };
    return acc;
  },
  {} as Record<string, any>
);

const devVitePlugins = isDev
  ? [
      eslint({ emitWarning: false }),
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "inline",
        manifest: {
          name: "LiventCord",
          short_name: "App",
          description: "LiventCord Desktop App",
          start_url: "/channels",
          scope: "/channels",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#000000",
          icons: [
            {
              src: "https://liventcord.github.io/LiventCord/app/images/icons/icon192.webp",
              sizes: "192x192",
              type: "image/webp"
            },
            {
              src: "https://liventcord.github.io/LiventCord/app/images/icons/icon512.webp",
              sizes: "512x512",
              type: "image/webp"
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === "document",
              handler: "NetworkFirst",
              options: { cacheName: "html-cache" }
            },
            {
              urlPattern: ({ request }) =>
                ["style", "script", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets-cache" }
            }
          ]
        }
      })
    ]
  : [eslint()];

export default defineConfig({
  compilation: {
    input: {
      index: "./src/index.html"
    },
    output: {
      path: "./output",
      publicPath: isDev ? "/" : "/LiventCord/app/",
      targetEnv: "browser"
    },
    minify: isDev ? false : true,
    sourcemap: isDev,
    persistentCache: true,
    partialBundling: {
      targetConcurrentRequests: 2,
      targetMinSize: 20,
      targetMaxSize: 2000,
      groups: [
        {
          name: "vendor",
          test: [
            "vue",
            "@vue/",
            "vuex",
            "croppie",
            "canvas-confetti",
            "browser-image-compression",
            "file-type",
            "dompurify",
            "dotenv",
            "process",
            "node_modules"
          ],
          groupType: "immutable",
          resourceType: "all"
        },
        {
          name: "app",
          test: ["./src/"],
          groupType: "mutable",
          resourceType: "all"
        }
      ],
      enforceResources: [
        {
          name: "vendor",
          test: [
            "vue",
            "@vue/",
            "vuex",
            "croppie",
            "canvas-confetti",
            "browser-image-compression",
            "file-type",
            "dompurify",
            "dotenv",
            "process",
            "node_modules"
          ]
        },
        {
          name: "app",
          test: ["./src/"]
        }
      ],
      enforceTargetConcurrentRequests: true,
      enforceTargetMinSize: true,
      immutableModules: ["node_modules"]
    }
  },

  server: {
    port: 3000,
    hmr: true,
    proxy: {
      ...proxyConfig,
      "/socket": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  plugins: [
    farmJsPluginVue({
      hmr: true,
      ssr: false
    })
  ],
  vitePlugins: devVitePlugins
});
