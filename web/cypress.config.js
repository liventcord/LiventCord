import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000/LiventCord/app/",
    env: {
      frontendUrl: "http://localhost:3000/LiventCord/app/",
      backendUrl: "https://liventcord.koyeb.app",
      userAgentMobile:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/114.0.5735.99 Mobile/15E148 Safari/604.1",
      viewportForX: "375",
      viewportyForY: "812"
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
