import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173/LiventCord/app/",
    env: {
      frontendUrl: "http://localhost:5173/LiventCord/app/",
      backendUrl: "https://liventcord.koyeb.app"
    },
    responseTimeout: 10000,
    execTimeout: 10000,
    defaultCommandTimeout: 10000,
    chromeWebSecurity: false
  },
  component: {
    devServer: {
      framework: "vue",
      bundler: "vite"
    }
  }
});
