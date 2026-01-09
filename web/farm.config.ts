import { defineConfig } from "@farmfe/core";
import farmJsPluginVue from "@farmfe/js-plugin-vue";

export default defineConfig({
  compilation: {
    presetEnv: false,
    input: {
      index: "./src/index.html"
    },
    output: {
      path: "./output",
      publicPath: "/LiventCord/app/",
      targetEnv: "browser"
    },
    minify: true,
    sourcemap: false,
    partialBundling: {
      targetConcurrentRequests: 2,
      targetMinSize: 20,
      targetMaxSize: 2000,
      groups: [
        {
          name: "vendor",
          test: [
            "vue",
            "@vue/",
            "vuex",
            "croppie",
            "canvas-confetti",
            "browser-image-compression",
            "file-type",
            "dompurify",
            "node_modules"
          ],
          groupType: "immutable",
          resourceType: "all"
        },
        {
          name: "app",
          test: ["./src/"],
          groupType: "mutable",
          resourceType: "all"
        }
      ],
      enforceResources: [
        {
          name: "vendor",
          test: [
            "vue",
            "@vue/",
            "vuex",
            "croppie",
            "canvas-confetti",
            "browser-image-compression",
            "file-type",
            "dompurify",
            "node_modules"
          ]
        },
        {
          name: "app",
          test: ["./src/"]
        }
      ],
      immutableModules: ["node_modules"]
    }
  },
  plugins: [
    farmJsPluginVue({
      hmr: false,
      ssr: false
    })
  ]
});
