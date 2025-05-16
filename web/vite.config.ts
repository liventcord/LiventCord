import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const env = loadEnv(mode, process.cwd());

  const proxyTarget = "http://localhost:5005";
  const proxyPaths = ["/api", "/profiles", "/guilds", "/attachments", "/auth"];
  const proxyConfig = proxyPaths.reduce((acc, path) => {
    acc[path] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: false
    };
    return acc;
  }, {} as Record<string, any>);

  return {
    root: "./src",
    publicDir: "../public",
    base: isDev ? "/" : "/LiventCord/app/",

    build: {
      outDir: "output",
      assetsDir: "ts",
      emptyOutDir: true,
      minify: isDev ? false : "terser",
      terserOptions: {
        compress: {
          passes: 3,
          drop_console: false //!isDev
        },
        mangle: { toplevel: true }
      },
      sourcemap: isDev,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;

            if (id.includes("vue/dist") || id.match(/node_modules\/@vue\//)) return "vue";
            if (id.includes("vuex")) return "vuex";
            if (id.includes("croppie")) return "croppie";
            if (id.includes("canvas-confetti")) return "confetti";
            if (id.includes("browser-image-compression")) return "image-compression";
            if (id.includes("file-type")) return "file-type";
            if (id.includes("dompurify")) return "dompurify";
            if (id.includes("dotenv")) return "dotenv";
            if (id.includes("process")) return "process";

            return "vendor";
          },
          entryFileNames: "assets/[name].[hash].js",
          chunkFileNames: "assets/[name].[hash].js",
          assetFileNames: "assets/[name].[hash].[ext]"
        }
      }
    },

    css: {
      postcss: {
        plugins: [autoprefixer, cssnano({ preset: "default" })]
      }
    },

    plugins: [
      vue(),
      eslintPlugin({ emitWarning: false }),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        devOptions: {
          enabled: true
        },
        manifest: {
          name: "LiventCord",
          short_name: "App",
          description: "LiventCord Desktop App",
          start_url: "/LiventCord/app/",
          scope: "/LiventCord/app/",
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
              options: {
                cacheName: "html-cache"
              }
            },
            {
              urlPattern: ({ request }) =>
                ["style", "script", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "assets-cache"
              }
            }
          ]
        }
      })
    ],

    server: {
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
    }
  };
});
