import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const proxyTarget = "http://localhost:5005";
  const proxyPaths = ["/api", "/profiles", "/guilds", "/attachments", "/auth"];
  const proxyConfig = proxyPaths.reduce(
    (acc, path) => {
      acc[path] = { target: proxyTarget, changeOrigin: true, secure: false };
      return acc;
    },
    {} as Record<string, any>
  );

  return {
    root: "./src",
    publicDir: "../public",
    base: "/",
    plugins: [vue(), eslintPlugin({ emitWarning: false })],
    css: {
      postcss: {
        plugins: [autoprefixer]
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
    }
  };
});
