import path from "path";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import eslintPlugin from "vite-plugin-eslint";
import autoprefixer from "autoprefixer";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname));

  const proxyTarget = env.VITE_BACKEND_URL || "http://localhost:5005";
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
    envDir: path.resolve(__dirname),
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
    },
    build: {
      outDir: path.resolve(__dirname, "output") 
    }
  };
});