import { openSettings } from "./settingsui.ts";
import { createBubble } from "./userList.ts";
import { createEl, getId } from "./utils.ts";
import { userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { copyId } from "./contextMenuActions.ts";
import { socketClient, SocketEvent } from "./socketEvents.ts";
import { SettingType } from "./types/interfaces.ts";
import { appState } from "./appState.ts";
import { drawProfilePopId } from "./profilePop.ts";
import { SVG } from "./svgIcons.ts";

export class UserStatus {
  private createdPanel: HTMLElement | undefined;
  public currentStatus = "Offline";
  private dropdown: HTMLElement | null = null;
  private timeoutId: any = null;
  private isTimeoutPending = false;
  private readonly statusColors: Record<string, string> = {
    online: "#23a55a",
    offline: "#80848E",
    idle: "#d8db1c",
    "do-not-disturb": "#F23F43"
  };
  private readonly statusTypes = {
    offline: "offline",
    online: "online",
    "do-not-disturb": "do-not-disturb",
    idle: "idle"
  };
  private readonly selfStatus = getId("self-status") as HTMLElement;

  constructor() {
    this.selfStatus.textContent = this.formatStatusText(
      this.statusTypes.offline
    );
    socketClient.on(SocketEvent.UPDATE_USER_STATUS, ({ userId, status }) => {
      this.updateUserOnlineStatus(userId, status);
    });
  }

  async initStatusPanel() {
    this.createdPanel = await this.createStatusPanel();
  }

  async showStatusPanel() {
    await this.initStatusPanel();
    if (!this.createdPanel) return;

    this.createdPanel.style.display = "flex";
    this.createdPanel.addEventListener("mousedown", (event) =>
      event.stopPropagation()
    );
    document.addEventListener("mousedown", this.handleOutsideClick);
  }

  private readonly handleOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (
      this.createdPanel &&
      target.className !== "status-option" &&
      !this.createdPanel.contains(target)
    ) {
      this.createdPanel.remove();
      document.removeEventListener("mousedown", this.handleOutsideClick);
    }
  };

  private updateSelfStatusBubble(statusBubble: HTMLElement) {
    statusBubble.className = "";
    statusBubble.classList.add(
      "panel-status-bubble",
      "status-bubble",
      this.currentStatus.toLowerCase()
    );
  }

  private createStatusPanel = async () => {
    if (!appState.currentUserId) return;

    const createdPanel = await drawProfilePopId(appState.currentUserId, true);
    if (!createdPanel) return;

    createdPanel.classList.add("statusPanelContainer");
    createdPanel.style.display = "none";

    const profileDisplay = createdPanel.querySelector(".profile-display");
    profileDisplay?.classList.add("status-profile");

    const statusBubble = createdPanel.querySelector(
      ".status-bubble"
    ) as HTMLElement;
    if (statusBubble) this.updateSelfStatusBubble(statusBubble);

    createdPanel.appendChild(statusBubble!);
    createdPanel
      .querySelector("#profile-container")
      ?.classList.add("panel-status-profile-titles");

    const topContainer = createdPanel.querySelector(
      "#profile-popup-top-container"
    ) as HTMLElement;
    if (topContainer) {
      topContainer.style.height = "22%";
      topContainer.style.top = "11%";
    }

    createdPanel.appendChild(this.createEditButton());
    createdPanel.appendChild(this.createSetStatusButton(createdPanel));
    createdPanel.appendChild(this.createCopyIdButton());

    return createdPanel;
  };

  private createStatusBubble(
    status: string = this.currentStatus,
    isMain: boolean = false
  ): HTMLElement | null {
    if (!status) return null;
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const bubble = createBubble(statusClass);
    bubble.classList.add(
      "status-button-bubble",
      "status-button-bubble-main",
      statusClass
    );
    return bubble;
  }

  private createEditStatusSvg(): HTMLElement {
    return createEl("div", {
      innerHTML: SVG.pencil
    });
  }

  private createCopyIdSvg(): HTMLElement {
    return createEl("div", {
      innerHTML: SVG.copyId
    });
  }

  private createEditButton(): HTMLElement {
    const editButton = createEl("button", {
      id: "status-edit-profile-button",
      className: "status-button"
    });
    editButton.appendChild(this.createEditStatusSvg());
    editButton.textContent += translations.getTranslation("edit-profile");

    editButton.addEventListener("click", () =>
      openSettings(SettingType.PROFILE, true)
    );
    return editButton;
  }

  private createCopyIdButton(): HTMLElement {
    const copyIdButton = createEl("button", {
      id: "status-copy-profile-button",
      className: "status-button"
    });
    copyIdButton.appendChild(this.createCopyIdSvg());
    copyIdButton.textContent +=
      translations.getContextTranslation("COPY_USER_ID");
    copyIdButton.addEventListener("click", (event: MouseEvent) => {
      if (appState.currentUserId) copyId(appState.currentUserId, event);
    });
    return copyIdButton;
  }

  private updateStatusOnPanel(status: string) {
    this.currentStatus = status;
    const button = getId("status-set-button");
    if (button) {
      button.innerHTML = "";
      const bubble = this.createStatusBubble();
      button.append(document.createTextNode(this.currentStatus));
      if (bubble) button.append(bubble);
    }
    const sanitizedStatus = this.currentStatus
      .replace(/\s+/g, "-")
      .toLowerCase();
    socketClient.send(SocketEvent.UPDATE_USER_STATUS, {
      status: sanitizedStatus
    });

    const selfBubble = getId("self-bubble") as HTMLElement;
    if (selfBubble) {
      selfBubble.className = "";
      selfBubble.classList.add(sanitizedStatus);
      this.setSelfStatus(sanitizedStatus);
    }
  }

  public setSelfStatus(status: string) {
    if (!status) return;

    this.currentStatus = status;
    this.selfStatus.textContent = this.formatStatusText(status);

    if (appState.currentUserId) {
      userManager.updateMemberStatus(appState.currentUserId, status);
    }

    const avatarPanelSelfBubble = getId("self-bubble");
    if (avatarPanelSelfBubble) {
      avatarPanelSelfBubble.className = "";
      avatarPanelSelfBubble.classList.add(status);
    }

    if (this.createdPanel) {
      const statusBubble = this.createdPanel.querySelector(
        ".status-bubble"
      ) as HTMLElement;
      if (statusBubble) this.updateSelfStatusBubble(statusBubble);
    }
  }

  public updateSelfStatus(status: string) {
    this.setSelfStatus(status);
  }

  public updateUserOnlineStatus(
    userId: string,
    status: string,
    isTyping?: boolean
  ) {
    if (!status && isTyping === undefined) return;

    if (userId === appState.currentUserId) {
      this.updateSelfStatus(status);
    }
    userManager.updateMemberStatus(userId, status, isTyping);
  }

  private createSetStatusButton(container: HTMLElement): HTMLElement {
    const statusButton = createEl("button", {
      id: "status-set-button",
      className: "status-button"
    });
    const bubble = this.createStatusBubble();
    const textNode = document.createTextNode(
      this.formatStatusText(this.currentStatus)
    );
    this.dropdown = this.createDropdown();

    statusButton.append(textNode);
    if (bubble) statusButton.append(bubble);
    container.append(statusButton);
    document.body.append(this.dropdown);

    const showDropdown = () => {
      if (this.dropdown) this.dropdown.style.display = "block";
      this.clearTimeoutIfNecessary();
    };

    const hideDropdown = (event: MouseEvent) => {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        if (this.dropdown) this.dropdown.style.display = "none";
        this.isTimeoutPending = false;
      }, 100);
      this.isTimeoutPending = true;
    };

    statusButton.addEventListener("mouseenter", showDropdown);
    statusButton.addEventListener("mouseleave", hideDropdown);

    let isDropdownVisible = false;
    statusButton.addEventListener("touchstart", (event) => {
      event.preventDefault();
      isDropdownVisible = !isDropdownVisible;
      if (this.dropdown)
        this.dropdown.style.display = isDropdownVisible ? "block" : "none";
    });
    statusButton.addEventListener("touchend", (event) =>
      event.preventDefault()
    );

    return statusButton;
  }

  private formatStatusText(status?: string) {
    const safeStatus = status?.toLowerCase() ?? "offline";
    return (
      translations.getTranslation(safeStatus) ??
      translations.getTranslation("offline")
    );
  }

  private createDropdown(): HTMLElement {
    const dropdown = createEl("div", { className: "status-dropdown" });
    const statuses = ["Online", "Idle", "Do Not Disturb", "Offline"];

    statuses.forEach((status) => {
      const option = createEl("div", { className: "status-option" });
      const bubble = this.createStatusBubble(status);
      if (bubble) option.appendChild(bubble);
      option.appendChild(document.createTextNode(status));

      option.addEventListener("click", () => this.updateStatusOnPanel(status));
      dropdown.appendChild(option);
    });

    dropdown.addEventListener("mouseenter", () => {
      if (this.dropdown) this.dropdown.style.display = "block";
      this.clearTimeoutIfNecessary();
    });

    dropdown.addEventListener("mouseleave", () => {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        if (this.dropdown) this.dropdown.style.display = "none";
        this.isTimeoutPending = false;
      }, 100);
      this.isTimeoutPending = true;
    });

    return dropdown;
  }

  private clearTimeoutIfNecessary() {
    if (this.isTimeoutPending) {
      clearTimeout(this.timeoutId);
      this.isTimeoutPending = false;
    }
  }
}
export let userStatus: UserStatus;
export function initializeUserStatus() {
  userStatus = new UserStatus();
}
