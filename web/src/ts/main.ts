import { createApp } from "vue";
import App from "../App.vue";
import store from "../store";
import SearchPanel from "../components/SearchPanel.vue";
const app = createApp(App);
app.use(store);
app.mount("#app");

const searchRoot = document.getElementById("tb-search");
if (searchRoot) {
  createApp(SearchPanel).mount(searchRoot);
}
