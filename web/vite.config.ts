import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const env = loadEnv(mode, process.cwd());

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
    base: "/LiventCord/app/",

    build: {
      outDir: "output",
      assetsDir: "ts",
      emptyOutDir: true,
      minify: isDev ? false : "terser",
      terserOptions: {
        compress: {
          passes: 3,
          drop_console: !isDev
        },
        mangle: { toplevel: true }
      },
      sourcemap: isDev,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]"
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
