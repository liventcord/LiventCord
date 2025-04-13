import { drawProfilePopId } from "./popups.ts";
import { openSettings, SettingType } from "./settingsui.ts";
import { createBubble } from "./userList.ts";
import { createEl, getId } from "./utils.ts";
import { currentUserId, userManager } from "./user.ts";
import { translations } from "./translations.ts";
import { copySelfName } from "./contextMenuActions.ts";
import { socketClient, SocketEvent } from "./socketEvents.ts";

export class UserStatus {
  private createdPanel: HTMLElement | undefined;
  public isSelfStatusOnline = false;
  public currentStatus = "Offline";
  private dropdown: HTMLElement | null = null;
  private timeoutId: any = null;
  private isTimeoutPending = false;
  private statusColors: Record<string, string> = {
    online: "#23a55a",
    offline: "#80848E",
    idle: "#d8db1c",
    "do-not-disturb": "#F23F43"
  };
  private statusTypes = {
    offline: "offline",
    online: "online",
    "do-not-disturb": "do-not-disturb",
    idle: "idle"
  };
  private selfStatus = getId("self-status") as HTMLElement;

  constructor() {
    this.selfStatus.textContent = this.formatStatusText(
      this.statusTypes.offline
    );
  }

  async initStatusPanel() {
    this.createdPanel = await this.createStatusPanel();
  }

  async showStatusPanel() {
    await this.initStatusPanel();
    if (!this.createdPanel) return;

    this.createdPanel.style.display = "flex";

    this.createdPanel.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("mousedown", this.handleOutsideClick);
  }

  private handleOutsideClick = (event: MouseEvent) => {
    console.log(
      event.target,
      this.createdPanel,
      this.createdPanel === this.createdPanel
    );
    const target = event.target as HTMLElement;
    if (!target) return;
    if (
      this.createdPanel &&
      target.className !== "status-option" &&
      !this.createdPanel.contains(event.target as Node)
    ) {
      this.createdPanel.remove();
      document.removeEventListener("mousedown", this.handleOutsideClick);
    }
  };
  updateSelfStatusbubble(statusBubble: HTMLElement) {
    statusBubble.classList.value = "";
    statusBubble.classList.add(
      "panel-status-bubble",
      "status-bubble",
      this.currentStatus
    );
  }
  async createStatusPanel() {
    const createdPanel = await drawProfilePopId(currentUserId, true);
    if (!createdPanel) return;

    createdPanel.classList.add("statusPanelContainer");
    createdPanel.style.display = "none";

    const profileDisplay = createdPanel.querySelector(".profile-display");
    profileDisplay?.classList.add("status-profile");

    const statusBubble = createdPanel.querySelector(
      ".status-bubble"
    ) as HTMLElement;
    if (!statusBubble) return;

    this.updateSelfStatusbubble(statusBubble);

    createdPanel.appendChild(statusBubble);

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
  }

  createStatusBubble(
    status: string = this.currentStatus,
    isMain: boolean = false
  ): HTMLElement | null {
    if (!status) return null;
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const bubble = createBubble(statusClass);
    bubble.classList.add("status-button-bubble", "status-button-bubble-main");
    bubble.classList.add(statusClass);
    return bubble;
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || "white";
  }

  getStatusBorder(status: string, isMain?: boolean): string {
    return `${isMain ? "6" : "8"}px solid ${this.getStatusColor(status)}`;
  }

  createEditStatusSvg(): HTMLElement {
    return createEl("div", {
      innerHTML: `<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z"></path></svg>`
    });
  }

  createCopyIdSvg(): HTMLElement {
    return createEl("div", {
      innerHTML: `<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M15.3 14.48c-.46.45-1.08.67-1.86.67h-1.39V9.2h1.39c.78 0 1.4.22 1.86.67.46.45.68 1.22.68 2.31 0 1.1-.22 1.86-.68 2.31Z" class=""></path><path fill="currentColor" fill-rule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm1 15h2.04V7.34H6V17Zm4-9.66V17h3.44c1.46 0 2.6-.42 3.38-1.25.8-.83 1.2-2.02 1.2-3.58s-.4-2.75-1.2-3.58c-.79-.83-1.92-1.25-3.38-1.25H10Z" clip-rule="evenodd" class=""></path></svg>`
    });
  }

  createEditButton(): HTMLElement {
    const editButton = createEl("button", {
      id: "status-edit-profile-button",
      className: "status-button"
    });
    editButton.appendChild(this.createEditStatusSvg());
    editButton.innerHTML += translations.getTranslation("edit-profile");
    editButton.addEventListener("click", () =>
      openSettings(SettingType.PROFILE, true)
    );
    return editButton;
  }

  createCopyIdButton(): HTMLElement {
    const copyIdButton = createEl("button", {
      id: "status-copy-profile-button",
      className: "status-button"
    });
    copyIdButton.appendChild(this.createCopyIdSvg());
    copyIdButton.innerHTML +=
      translations.getContextTranslation("COPY_USER_ID");
    copyIdButton.addEventListener("click", (event: MouseEvent) =>
      copySelfName(event)
    );
    return copyIdButton;
  }

  updateStatusOnPanel(status: string) {
    this.currentStatus = status;
    const button = getId("status-set-button");
    if (button) {
      button.innerHTML = "";
      const bubble = this.createStatusBubble();

      button.append(document.createTextNode(this.currentStatus));
      if (bubble) {
        button.append(bubble);
      }
    }
    const sanitizedStatus = this.currentStatus
      .replace(/\s+/g, "-")
      .toLowerCase();
    socketClient.send(SocketEvent.UPDATE_USER_STATUS, {
      status: sanitizedStatus
    });

    const selfBubble = getId("self-bubble") as HTMLElement;
    if (selfBubble) {
      selfBubble.classList.value = "";
      selfBubble.classList.add(sanitizedStatus);
      this.setSelfStatus(sanitizedStatus);
    }
  }
  setSelfStatus(status: string) {
    if (!status) return;
    this.currentStatus = status;

    this.selfStatus.textContent = this.formatStatusText(status);
    const avatarPanelSelfBubble = getId("self-bubble");

    if (currentUserId) {
      userManager.updateMemberStatus(currentUserId, status);
    } else {
      console.error("currentUserId is not defined");
    }
    console.warn(status);

    if (avatarPanelSelfBubble) {
      avatarPanelSelfBubble.classList.value = "";
      avatarPanelSelfBubble.classList.add(status);
    }
    if (this.createdPanel) {
      const statusBubble = this.createdPanel.querySelector(
        ".status-bubble"
      ) as HTMLElement;
      this.updateSelfStatusbubble(statusBubble);
    }
  }
  updateSelfStatus(status: string) {
    const selfBubble = getId("self-bubble") as HTMLElement;

    if (selfBubble) {
      selfBubble.classList.value = "";
      selfBubble.classList.add(status);
    }
    this.setSelfStatus(status);
  }

  updateUserOnlineStatus(userId: string, status: string) {
    if (userId === currentUserId) {
      this.updateSelfStatus(status);
    }
    console.log(userId, status);
    userManager.updateMemberStatus(userId, status);
  }

  createSetStatusButton(container: HTMLElement): HTMLElement {
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
    if (bubble) {
      statusButton.append(bubble);
    }
    container.append(statusButton);
    document.body.append(this.dropdown);

    const showDropdown = () => {
      if (this.dropdown) this.dropdown.style.display = "block";
      this.clearTimeoutIfNecessary();
    };

    const hideDropdown = (event: MouseEvent) => {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        if (
          this.dropdown &&
          !this.dropdown.contains(event.relatedTarget as Node) &&
          event.relatedTarget !== this.dropdown
        ) {
          this.dropdown.style.display = "none";
        }
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
      if (isDropdownVisible) {
        if (this.dropdown) this.dropdown.style.display = "block";
      } else {
        if (this.dropdown) this.dropdown.style.display = "none";
      }
    });

    statusButton.addEventListener("touchend", (event) => {
      event.preventDefault();
    });

    return statusButton;
  }

  formatStatusText(status: string) {
    const statusLower = status.toLowerCase();
    return (
      translations.getTranslation(statusLower) ??
      translations.getTranslation(this.statusTypes.offline)
    );
  }

  createDropdown(): HTMLElement {
    const dropdown = createEl("div", { className: "status-dropdown" });
    const statuses = ["Online", "Idle", "Do Not Disturb", "Offline"];

    statuses.forEach((status) => {
      const option = createEl("div", { className: "status-option" });
      const bubble = this.createStatusBubble(status);
      if (bubble) {
        option.appendChild(bubble);
      }
      option.appendChild(document.createTextNode(status));

      option.addEventListener("click", () => {
        dropdown.style.display = "none";
        this.updateStatusOnPanel(status);
      });

      dropdown.appendChild(option);
    });

    dropdown.addEventListener("mouseenter", () => {
      if (this.dropdown) this.dropdown.style.display = "block";
      this.clearTimeoutIfNecessary();
    });

    dropdown.addEventListener("mouseleave", () => {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        if (this.dropdown) {
          this.dropdown.style.display = "none";
        }
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
