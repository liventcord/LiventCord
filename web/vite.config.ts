import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const env = loadEnv(mode, process.cwd());

  const backendUrl = env.VITE_BACKEND_URL;
  if (!backendUrl) {
    throw new Error(
      "Vite backend URL is unset! Please set VITE_BACKEND_URL in your environment variables."
    );
  }

  const proxyTarget = "http://localhost:5005";
  const commonProxyConfig = {
    target: proxyTarget,
    changeOrigin: true,
    secure: false
  };

  const proxyPaths = ["/api", "/profiles", "/guilds", "/attachments", "/auth"];

  const proxyConfig = proxyPaths.reduce((acc, path) => {
    acc[path] = commonProxyConfig;
    return acc;
  }, {});

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

            if (id.includes("vue/dist") || id.match(/node_modules\/@vue\//))
              return "vue";
            if (id.includes("vuex")) return "vuex";
            if (id.includes("croppie")) return "croppie";
            if (id.includes("canvas-confetti")) return "confetti";
            if (id.includes("browser-image-compression"))
              return "image-compression";
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

    plugins: [vue(), eslintPlugin({ emitWarning: false })],

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
