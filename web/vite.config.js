import { defineConfig } from "vite";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  const proxyTarget = import.meta.env.VITE_PROXY_TARGET || "http://localhost:5005";

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
    base: "/",

    build: {
      outDir: "output",
      assetsDir: "ts",
      emptyOutDir: true,
      minify: isDev ? false : "terser",
      terserOptions: {
        compress: { drop_console: !isDev },
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
          }
        }
      }
    },
    css: {
      postcss: {
        plugins: [autoprefixer, cssnano({ preset: "default" })]
      }
    },
    plugins: [eslintPlugin({ emitWarning: false })],
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