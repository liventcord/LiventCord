import { getId } from "./utils";

export let currentSearchUiIndex = -1;
export function setCurrentSearchUiIndex(index: number) {
  currentSearchUiIndex = index;
}
export const userMentionDropdown = getId(
  "userMentionDropdown"
) as HTMLSelectElement;
