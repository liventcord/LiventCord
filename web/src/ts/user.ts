import { reactive } from "vue";

import store from "../store.ts";
import {
  selfDiscriminator,
  updateSelfName,
  updateSelfProfile
} from "./avatar.ts";
import { initialState } from "./app.ts";
import { socketClient, SocketEvent } from "./socketEvents.ts";
import { alertUser } from "./ui.ts";
import { translations } from "./translations.ts";
import { getId } from "./utils.ts";
import { CLYDE_ID, SYSTEM_ID } from "./chat.ts";
import { Friend, UserInfo } from "./types/interfaces.ts";
import { appState } from "./appState.ts";
import { userStatus } from "./status.ts";

export const DEFAULT_DISCRIMINATOR = "0000";

export const deletedUser = "Deleted User";
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id: string) {
  if (!id) {
    return;
  }
  lastTopSenderId = id;
}

function validatePassword(password: string) {
  return password && password.length >= 5;
}

export function changePassword(
  event: KeyboardEvent | null,
  currentInput: HTMLInputElement,
  newPasswordInput: HTMLInputElement,
  newPasswordConfirmInput: HTMLInputElement,
  successCallback: CallableFunction
) {
  const currentPasswordValue = currentInput.value;
  const passwordValue = newPasswordInput.value;
  const newPasswordConfirm = newPasswordConfirmInput.value;

  if (!currentPasswordValue || !passwordValue || !newPasswordConfirm) {
    alertUser(translations.getSettingsTranslation("PasswordInvalid"));
    return;
  }

  if (passwordValue !== newPasswordConfirm) {
    alertUser(translations.getSettingsTranslation("PasswordConfirmationAlert"));
    return;
  }

  if (event) {
    event.preventDefault();
  }

  currentInput.setCustomValidity("");
  newPasswordInput.setCustomValidity("");
  newPasswordConfirmInput.setCustomValidity("");

  if (!validatePassword(passwordValue)) {
    setInputValidity(
      newPasswordInput,
      translations.getSettingsTranslation("PasswordInvalid")
    );
    return;
  }

  const formData = new FormData();
  formData.append("CurrentPassword", currentPasswordValue);
  formData.append("NewPassword", passwordValue);

  fetch("/auth/change-password", {
    method: "POST",
    body: formData
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 400) {
          return response.text().then((text) => {
            if (text === "Current password is incorrect") {
              alertUser(translations.getSettingsTranslation("PasswordInvalid"));
            }
          });
        } else {
          alertUser(String(response.status));
        }
        return;
      }
      successCallback();
      alertUser(translations.getSettingsTranslation("PasswordChangeSuccess"));
    })
    .catch((error) => {
      console.error("Error:", error);
      alertUser(translations.getSettingsTranslation("PasswordChangeError"));
    });
}

function setInputValidity(input: HTMLInputElement, message: string) {
  input.setCustomValidity(message);
  input.reportValidity();
}

class UserManager {
  private userNames = reactive<{ [userId: string]: UserInfo }>({});

  constructor() {
    this.userNames[CLYDE_ID] = {
      userId: CLYDE_ID,
      nickName: "Clyde",
      discriminator: DEFAULT_DISCRIMINATOR,
      isBlocked: false,
      status: "offline",
      description: ""
    };
    this.userNames[SYSTEM_ID] = {
      userId: SYSTEM_ID,
      nickName: "System",
      discriminator: DEFAULT_DISCRIMINATOR,
      isBlocked: false,
      status: "offline",
      description: ""
    };
  }

  setUserNick(newNickname: string) {
    appState.set({ currentUserNick: newNickname });
  }

  setCurrentUserId(id: string) {
    appState.set({ currentUserId: id });
  }

  getUserInfo(userId: string) {
    return this.userNames[userId];
  }

  getUserNick(userId: string): string {
    return this.userNames[userId]?.nickName ?? deletedUser;
  }

  async fetchUserNickOnce(userId: string): Promise<string> {
    let nick = this.userNames[userId]?.nickName ?? deletedUser;
    if (nick === deletedUser) {
      await new Promise((r) => setTimeout(r, 100));
      nick = this.userNames[userId]?.nickName ?? deletedUser;
    }
    return nick;
  }

  getUserProfileVersion(userId: string): string {
    return userId === appState.currentUserId
      ? initialState.user.profileVersion
      : (this.userNames[userId]?.profileVersion ?? "");
  }

  setProfileVersion(userId: string, version: string): void {
    this.userNames[userId].profileVersion = version;
  }

  getUserDiscriminator(userId: string): string {
    return this.userNames[userId]?.discriminator ?? DEFAULT_DISCRIMINATOR;
  }

  getUserIdFromNick(nick: string): string | null {
    for (const [userId, userInfo] of Object.entries(this.userNames)) {
      if (userInfo.nickName === nick) {
        return userId;
      }
    }
    return null;
  }

  isUserBlocked(userId: string): boolean {
    return this.userNames[userId]?.isBlocked ?? false;
  }
  addUserFriend(friend: Friend) {
    this.addUser(
      friend.userId,
      friend.nickName,
      friend.discriminator,
      friend.profileVersion,
      false
    );
  }
  addUser(
    userId: string,
    nick: string = deletedUser,
    discriminator: string = "",
    profileVersion?: string,
    isBlocked?: boolean
  ) {
    const existing = this.userNames[userId] || {};

    if (!profileVersion && existing.profileVersion) {
      console.error(
        `Warning: profileVersion for user ${userId} exists but new data did not provide it`
      );
    }

    this.userNames[userId] = {
      userId,
      nickName:
        nick !== deletedUser ? nick : (existing.nickName ?? deletedUser),
      discriminator: discriminator || existing.discriminator || "",
      profileVersion: profileVersion || existing.profileVersion || "",
      isBlocked:
        isBlocked !== undefined
          ? Boolean(isBlocked)
          : (existing.isBlocked ?? false),
      status:
        existing.status ||
        (userId === appState.currentUserId ? "online" : "offline"),
      description: existing.description || ""
    };
  }

  async isNotOffline(userId: string): Promise<boolean> {
    const currentStatus = this.userNames[userId]?.status;
    if (currentStatus) {
      return currentStatus !== "offline";
    }
    const fetchedStatus = await this.fetchImmediateStatus(userId);
    return fetchedStatus !== null && fetchedStatus !== "offline";
  }

  updateMemberStatus(userId: string, status: string, isTyping?: boolean): void {
    if (!this.userNames[userId]) {
      console.warn(
        `User ${userId} not found in userManager, adding with status ${status}`
      );
      this.addUser(userId, deletedUser, "", "", false);
    }

    console.log(`UserManager updating ${userId} to status: ${status}`);
    this.userNames[userId].status = status;

    if (store) {
      store.dispatch("updateStatusInMembersList", { userId, status, isTyping });
    }
  }
  ensureUserExists(userId: string, nickName?: string): void {
    if (!this.userNames[userId]) {
      this.addUser(userId, nickName || deletedUser);
    }
  }
  getMemberStatus(userId: string): string {
    return this.userNames[userId]?.status ?? "offline";
  }

  async fetchImmediateStatus(userId: string): Promise<string | null> {
    return new Promise((resolve) => {
      socketClient.getUserStatus([userId]);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status);
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);
      setTimeout(() => {
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve(null);
      }, 500);
    });
  }

  async getStatusString(userId: string): Promise<string> {
    const currentStatus = this.userNames[userId]?.status;
    if (currentStatus) {
      return currentStatus;
    }
    const fetchedStatus = await this.fetchImmediateStatus(userId);
    return fetchedStatus && fetchedStatus.trim() !== ""
      ? fetchedStatus
      : "offline";
  }

  async isOnline(userId: string): Promise<boolean> {
    const status = await this.getStatusString(userId);
    return status !== "offline";
  }
}

export const userManager = new UserManager();

export function initializeProfile() {
  userManager.setCurrentUserId(initialState.user.userId);
  userManager.addUser(
    initialState.user.userId,
    initialState.user.nickname,
    initialState.user.discriminator,
    initialState.user.profileVersion,
    false
  );
  if (!appState.currentUserId) return;
  socketClient.onUserIdAvailable(appState.currentUserId);
  appState.set({ currentUserNick: initialState.user.nickname });
  appState.set({ currentDiscriminator: initialState.user.discriminator });
  selfDiscriminator.textContent = "#" + initialState.user.discriminator;
  const profileDiscriminator = getId("profile-discriminator");
  if (profileDiscriminator) {
    profileDiscriminator.textContent = "#" + initialState.user.discriminator;
  }
  userStatus.setSelfStatus(initialState.user.status);
  updateSelfProfile(initialState.user.userId, initialState.user.nickname);
  updateSelfName(initialState.user.nickname);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + "#" + initialState.user.discriminator;
}
