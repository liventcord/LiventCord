import { createApp } from "vue";
import App from "../App.vue";
import store from "../store";
import SearchPanel from "../components/SearchPanel.vue";
import DmList from "../components/DmList.vue";
import { createEl } from "./utils";

const app = createApp(App);
app.use(store);
app.mount("#app");

const teleportTarget = createEl("div");
teleportTarget.id = "search-messages-root";
document.body.appendChild(teleportTarget);

const searchRoot = document.getElementById("tb-search");
if (searchRoot) {
  const searchApp = createApp(SearchPanel);
  searchApp.use(store);
  searchApp.mount(searchRoot);
}

const dmListRoot = document.getElementById("dm-container-parent");
if (dmListRoot) {
  const dmListApp = createApp(DmList);
  dmListApp.use(store);
  dmListApp.mount(dmListRoot);
} else {
  console.error(
    "[main] #dm-container-parent not found in DOM — DmList not mounted"
  );
}
