import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {},
    baseUrl: "http://localhost:5005"
  },

  component: {
    devServer: {
      framework: "vue",
      bundler: "vite"
    }
  }
});
