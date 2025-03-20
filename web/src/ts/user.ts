import {
  selfDiscriminator,
  selfName,
  selfStatus,
  updateSelfProfile
} from "./avatar.ts";
import { initialState } from "./app.ts";
import { translations } from "./translations.ts";
import { getId } from "./utils.ts";
import { socketClient, SocketEvent } from "./socketEvents.ts";

export interface Member {
  userId: string;
  nickName: string;
  status: string;
}

export let currentUserId: string;

export let currentDiscriminator: string;
export let currentUserNick: string;
export interface UserInfo {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  description?: string;
  isFriendsRequestToUser?: boolean;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isPending?: boolean;
  isBlocked?: boolean;
}

export const deletedUser = "Deleted User";
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id: string) {
  if (!id) return;
  lastTopSenderId = id;
}
class UserManager {
  private selfOnline = false;
  private userNames: { [userId: string]: UserInfo } = {};

  private statusCache: Record<string, Promise<boolean> | boolean> = {};

  constructor() {
    this.userNames["1"] = {
      userId: "1",
      nickName: "Clyde",
      discriminator: "0000",
      isBlocked: false,
      status: "offline",
      description: ""
    };
  }

  setUserNick(newNickname: string) {
    currentUserNick = newNickname;
  }

  setCurrentUserId(id: string) {
    currentUserId = id;
  }

  getUserInfo(userId: string) {
    return this.userNames[userId];
  }

  getUserNick(userId: string): string {
    if (userId && currentUserId && currentUserId === userId) {
      return currentUserNick;
    }
    return this.userNames[userId]?.nickName ?? "Deleted User";
  }

  getUserDiscriminator(userId: string): string {
    return this.userNames[userId]?.discriminator ?? "0000";
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

  addUser(
    userId: string,
    nick: string = "",
    discriminator: string = "",
    isBlocked?: boolean
  ) {
    console.log("Adding user: ", userId, nick, discriminator);

    if (!nick) {
      console.error("Adding user without nick!: ", userId, discriminator);
      return;
    }

    this.userNames[userId] = {
      nickName: nick,
      discriminator,
      isBlocked: Boolean(isBlocked),
      userId,
      status: "offline",
      description: ""
    };
  }

  isSelfOnline() {
    return this.selfOnline;
  }

  updateMemberStatus(userId: string, status: string): void {
    if (this.userNames[userId]) {
      this.userNames[userId].status = status;
    }
  }

  getMemberStatus(userId: string): string {
    return this.userNames[userId]?.status ?? "offline";
  }

  async isOnline(userId: string): Promise<boolean> {
    if (this.statusCache[userId] instanceof Promise) {
      return this.statusCache[userId];
    }

    if (this.statusCache[userId] !== undefined) {
      return this.statusCache[userId] as boolean;
    }

    const currentStatus = this.userNames[userId]?.status;
    if (currentStatus !== undefined) {
      this.statusCache[userId] = currentStatus === "online";
      return this.statusCache[userId];
    }

    const statusPromise = this.getStatus(userId);
    this.statusCache[userId] = statusPromise;
    const isOnline = await statusPromise;
    this.statusCache[userId] = isOnline;
    return isOnline;
  }

  private async fetchImmediateStatus(userId: string): Promise<string | null> {
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
      }, 200);
    });
  }

  async getStatus(userId: string): Promise<boolean> {
    return Promise.race([
      this.fetchImmediateStatus(userId).then((status) =>
        status !== null ? status === "online" : null
      ),
      this.pollStatusBoolean(userId, 3000)
    ]).then((status) => status ?? false);
  }

  async getStatusString(userId: string): Promise<string> {
    return Promise.race([
      this.fetchImmediateStatus(userId).then((status) =>
        status !== null ? status : null
      ),
      this.pollStatusString(userId, 3000)
    ]).then((status) => status ?? "offline");
  }

  private pollStatusBoolean(userId: string, timeout: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const checkStatus = setInterval(() => {
        const updatedStatus = this.userNames[userId]?.status;
        if (updatedStatus !== undefined) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(updatedStatus === "online");
        }
      }, 100);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status === "online");
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);

      setTimeout(() => {
        clearInterval(checkStatus);
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve(false);
      }, timeout);

      socketClient.getUserStatus([userId]);
    });
  }

  private pollStatusString(userId: string, timeout: number): Promise<string> {
    return new Promise<string>((resolve) => {
      const checkStatus = setInterval(() => {
        const updatedStatus = this.userNames[userId]?.status;
        if (updatedStatus !== undefined) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(updatedStatus);
        }
      }, 100);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status);
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);

      setTimeout(() => {
        clearInterval(checkStatus);
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve("offline");
      }, timeout);

      socketClient.getUserStatus([userId]);
    });
  }
}

export const userManager = new UserManager();

const statusTypes = {
  offline: "offline",
  online: "online",
  "dont-disturb": "dont-disturb",
  idle: "idle"
};

function setSelfStatus(status: string) {
  const status_translated =
    translations.getTranslation(
      statusTypes[status as keyof typeof statusTypes]
    ) ??
    translations.getTranslation(statusTypes.offline) ??
    "Unknown";

  selfStatus.textContent = status_translated;
}

export function initializeProfile() {
  userManager.setCurrentUserId(initialState.user.userId);
  currentUserNick = initialState.user.nickname;
  currentDiscriminator = initialState.user.discriminator;
  selfName.textContent = currentUserNick;
  selfDiscriminator.textContent = "#" + initialState.user.discriminator;
  setSelfStatus(initialState.user.status);
  updateSelfProfile(currentUserId, currentUserNick);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + "#" + initialState.user.discriminator;
}
const selfBubble = getId("self-bubble") as HTMLElement;

function updateSelfStatus(status: string) {
  if (!selfBubble) return;
  selfBubble.classList.value = "";
  selfBubble.classList.add(status);
  setSelfStatus(status);
}

export function updateUserOnlineStatus(userId: string, status: string) {
  if (userId === currentUserId) {
    updateSelfStatus(status);
  }
  console.log(userId, status);

  userManager.updateMemberStatus(userId, status);

  console.log(`User ${userId} not found in any guild`);
}
