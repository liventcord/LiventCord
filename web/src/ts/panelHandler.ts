// panelHandler.ts
import { ref, type Ref } from "vue";

interface PanelState {
  selectedPanelType: Ref<string>;
  isMediaPanelTeleported: Ref<boolean>;
  hasTeleportedOnce: Ref<boolean>;
}
export const selectedPanelType = ref("");
export const isMediaPanelTeleported = ref(false);
export const hasTeleportedOnce = ref(false);

type OpenCloseCallbacks = {
  openMediaPanel: (type: string) => void;
  closeMediaPanel: () => void;
};

export function handlePanelButtonClickExternal(
  type: string,
  state: PanelState,
  callbacks: OpenCloseCallbacks
) {
  const { selectedPanelType, isMediaPanelTeleported, hasTeleportedOnce } =
    state;
  const { openMediaPanel, closeMediaPanel } = callbacks;

  const isSameType = selectedPanelType.value === type;

  if (type === "media") {
    if (!hasTeleportedOnce.value) {
      isMediaPanelTeleported.value = true;
      hasTeleportedOnce.value = true;
      selectedPanelType.value = type;
      setTimeout(() => openMediaPanel(type), 100);
      return;
    }

    if (isSameType) {
      selectedPanelType.value = "";
      isMediaPanelTeleported.value = false;
      closeMediaPanel();
    } else {
      selectedPanelType.value = type;
      isMediaPanelTeleported.value = true;
      setTimeout(() => openMediaPanel(type), 100);
    }
  } else {
    isMediaPanelTeleported.value = false;
    selectedPanelType.value = isSameType ? "" : type;
    if (!isSameType) {
      setTimeout(() => openMediaPanel(type), 100);
    } else {
      closeMediaPanel();
    }
  }
}

interface PanelState {
  selectedPanelType: Ref<string>;
  isMediaPanelTeleported: Ref<boolean>;
  hasTeleportedOnce: Ref<boolean>;
}

