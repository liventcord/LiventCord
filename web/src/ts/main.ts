import { createApp } from "vue";
import App from "../App.vue";
import store from "../store";
import SearchPanel from "../components/SearchPanel.vue";

const app = createApp(App);
app.use(store);
app.mount("#app");

const teleportTarget = document.createElement("div");
teleportTarget.id = "search-messages-root";
document.body.appendChild(teleportTarget);

const searchRoot = document.getElementById("tb-search");
if (searchRoot) {
  const searchApp = createApp(SearchPanel);
  searchApp.use(store);
  searchApp.mount(searchRoot);
}
