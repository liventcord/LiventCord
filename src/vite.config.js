import { defineConfig } from "vite";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const proxyTarget = "http://localhost:5005";

  const commonProxyConfig = {
    target: proxyTarget,
    changeOrigin: true,
    secure: false
  };

  const proxyPaths = [
    "/api",
    "/vendor",
    "/profiles",
    "/images",
    "/guilds",
    "/auth",
    "/sounds"
  ];

  const proxyConfig = proxyPaths.reduce((acc, path) => {
    acc[path] = commonProxyConfig;
    return acc;
  }, {});

  return {
    root: "./assets",
    base: isDev ? "/" : "/app",
    build: {
      outDir: "../wwwroot/app",
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
          // eslint-disable-next-line consistent-return
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
