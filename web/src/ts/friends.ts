import {
  disableElement,
  reCalculateFriTitle,
  enableElement,
  setWindowName,
  parseUsernameDiscriminator,
  getId,
  isValidFriendName
} from "./utils.ts";
import { getSelfFullDisplay, currentUserId, UserInfo } from "./user.ts";
import { handleResize } from "./ui.ts";
import {
  populateFriendsContainer,
  friendsContainer,
  isAddFriendsOpen,
  openAddFriend,
  printFriendMessage,
  ButtonTypes,
  createButtonWithBubblesImg,
  updateUsersActivities,
  updateFriendMenu
} from "./friendui.ts";
import { translations } from "./translations.ts";
import { apiClient, EventType } from "./api.ts";
import { createTooltipAtCursor } from "./tooltip.ts";

const pendingAlertRight = getId("pendingAlertRight") as HTMLElement;
const pendingAlertLeft = getId("pendingAlertLeft") as HTMLElement;

const FriendErrorType = {
  ERR_INVALID_EVENT: "ERR_INVALID_EVENT",
  ERR_CANNOT_ADD_SELF: "ERR_CANNOT_ADD_SELF",
  ERR_USER_NOT_FOUND: "ERR_USER_NOT_FOUND",
  ERR_INVALID_IDENTIFIER: "ERR_INVALID_IDENTIFIER",
  ERR_FRIEND_REQUEST_EXISTS: "ERR_FRIEND_REQUEST_EXISTS",
  ERR_FRIEND_REQUEST_NOT_EXISTS: "ERR_FRIEND_REQUEST_NOT_EXISTS",
  ERR_REQUEST_ALREADY_ACCEPTED: "ERR_REQUEST_ALREADY_ACCEPTED",
  ERR_NOT_FRIENDS: "ERR_NOT_FRIENDS",
  ERR_REQUEST_NOT_SENT: "ERR_REQUEST_NOT_SENT",
  ERR_SUCCESS: "ERR_SUCCESS"
};
interface FriendData {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  isOnline?: boolean;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isPending: boolean;
  isFriendsRequestToUser: boolean;
}

export class Friend implements UserInfo {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  isOnline?: boolean;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isFriendsRequestToUser: boolean;
  isPending: boolean;
  publicUser?: any;

  constructor(friend: FriendData) {
    this.userId = friend.userId;
    this.nickName = friend.nickName;
    this.discriminator = friend.discriminator;
    this.status = friend.status;
    this.isOnline = friend.isOnline;
    this.description = friend.description;
    this.createdAt = friend.createdAt;
    this.lastLogin = friend.lastLogin;
    this.socialMediaLinks = friend.socialMediaLinks;
    this.isFriendsRequestToUser = friend.isFriendsRequestToUser;
    this.isPending = friend.isPending;
    this.activity = friend.activity;
  }
}

class FriendsCache {
  friendsCache: Record<string, Friend>;
  dmFriends: Record<string, Friend>;
  currentDmId: string;

  constructor() {
    this.friendsCache = {};
    this.dmFriends = {};
    this.currentDmId = "";
  }

  setupDmFriends(friends: Record<string, Friend>) {
    this.dmFriends = friends;
  }

  initialiseFriends(initData: Record<string, Friend>) {
    this.friendsCache = {};

    Object.values(initData).forEach((friend) => {
      this.friendsCache[friend.userId] = friend;
    });

    populateFriendsContainer(Object.values(this.friendsCache));

    requestAnimationFrame(() => {
      const friends = this.cacheFriendToFriendConverter();
      for (const friend of friends) {
        updateUsersActivities(friend);
      }
    });
  }

  addFriend(friendOrArray: Friend | UserInfo | any) {
    if (Array.isArray(friendOrArray)) {
      for (const friendItem of friendOrArray) {
        this.addSingleFriend(friendItem);
      }
    } else {
      this.addSingleFriend(friendOrArray);
    }
  }

  private addSingleFriend(friend: Friend | UserInfo) {
    if (!friend || !friend.userId) {
      console.error("Invalid friend data:", friend);
      return;
    }

    const userId = friend.userId;

    if (friend instanceof Friend) {
      this.friendsCache[userId] = friend;
    } else {
      const friendData: FriendData = {
        userId: friend.userId,
        nickName: friend.nickName || "",
        discriminator: friend.discriminator || "",
        status: friend.status,
        isOnline: friend.isOnline,
        description: friend.description,
        createdAt: friend.createdAt,
        lastLogin: friend.lastLogin,
        socialMediaLinks: friend.socialMediaLinks || [],
        isFriendsRequestToUser: friend.isFriendsRequestToUser || false,
        isPending: friend.isPending || false,
        activity: friend.activity
      };

      this.friendsCache[userId] = new Friend(friendData);
    }

    console.warn("Added friend:", this.friendsCache);
  }

  removeFriend(userId: string) {
    console.log("Removing friend:", userId);

    if (userId in this.friendsCache) {
      delete this.friendsCache[userId];
      console.log("Friend removed successfully");
    } else {
      console.log("Friend not found in cache with ID:", userId);
      console.log("Available keys:", Object.keys(this.friendsCache));
    }

    console.log("Friends after removal:", this.friendsCache);
  }

  isFriend(userId: string): boolean {
    return (
      userId !== currentUserId &&
      userId in this.friendsCache &&
      !this.friendsCache[userId].isPending
    );
  }

  //Did we sent request to this user
  hasRequestToFriend(userId: string) {
    return (
      userId !== currentUserId &&
      userId in this.friendsCache &&
      this.friendsCache[userId].isPending
    );
  }

  userExistsDm(userId: string): boolean {
    return userId in this.dmFriends;
  }

  getFriendDiscriminator(friendId: string): string | undefined {
    return this.friendsCache[friendId]?.discriminator;
  }

  isOnline(userId: string): boolean {
    return !!this.friendsCache[userId]?.isOnline;
  }

  cacheFriendToFriendConverter() {
    console.log("Pulling from cache: ", this.friendsCache);
    return Object.values(this.friendsCache).map((friend) => new Friend(friend));
  }
}
export const friendsCache = new FriendsCache();

//actions

function getFriendMessage(
  userNick: string,
  isSuccess: boolean,
  errorType: string,
  status?: string
): string {
  if (isSuccess) {
    return translations.replacePlaceholder(errorType, { userNick });
  } else if (status) {
    return translations.getFriendErrorMessage(status);
  }
  return "";
}

function displayFriendActionMessage(
  userNick: string,
  isSuccess: boolean,
  errorType: string,
  status?: string
): void {
  const text = isSuccess
    ? getFriendMessage(userNick, isSuccess, errorType, status)
    : getFriendMessage(userNick, false, errorType, status);

  printFriendMessage(text);
}
interface FriendMessage {
  userId: string;
  userNick: string;
  userData?: UserInfo;
  isSuccess: boolean;
  type: string;
}

function handleAddFriendResponse(message: FriendMessage): void {
  const { userNick, isSuccess, userData } = message;
  console.log(message);
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_FRIEND_REQUEST_EXISTS
  );
  if (userData) {
    console.log("Pushing: ", userData);
    friendsCache.addFriend(userData);
    updateFriendMenu();
  }
}

function handleAcceptFriendRequestResponse(message: FriendMessage): void {
  const { userId, userNick, userData, isSuccess } = message;

  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_ALREADY_ACCEPTED
  );

  if (isSuccess && userData) {
    const updatedUserData: FriendData = {
      userId: userData.userId,
      nickName: userData.nickName,
      discriminator: userData.discriminator,
      status: userData.status ?? "",
      activity: userData.activity ?? "",
      isOnline: userData.isOnline ?? false,
      description: userData.description,
      isFriendsRequestToUser: userData.isFriendsRequestToUser ?? false,
      createdAt: userData.createdAt,
      lastLogin: userData.lastLogin,
      socialMediaLinks: userData.socialMediaLinks,
      isPending: userData.isPending ?? false
    };

    const newFriend = new Friend(updatedUserData);

    friendsCache.friendsCache[userId] = newFriend;

    disableElement(pendingAlertRight);
    disableElement(pendingAlertLeft);
    document.title = "LiventCord";
  }
}

function handleRemoveFriendResponse(message: FriendMessage): void {
  const { userId, userNick, isSuccess } = message;

  if (isSuccess) {
    const friCard = friendsContainer.querySelector(`#${CSS.escape(userId)}`);
    if (friCard) {
      friCard.remove();
    }
    friendsCache.removeFriend(userId);
    reCalculateFriTitle();
  }

  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_NOT_FRIENDS
  );
}

function handleDenyFriendRequestResponse(message: FriendMessage): void {
  const { userNick, isSuccess } = message;
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_NOT_SENT
  );
}

export function handleFriendEventResponse(message: FriendMessage): void {
  const { type } = message;
  console.log(type);

  switch (type) {
    case "add_friend":
    case "add_friend_id":
      handleAddFriendResponse(message);
      break;
    case "accept_friend_request":
      handleAcceptFriendRequestResponse(message);
      break;
    case "remove_friend":
    case "remove_friend_request":
      handleRemoveFriendResponse(message);
      break;
    case "deny_friend_request":
      handleDenyFriendRequestResponse(message);
      break;
    default:
      printFriendMessage("");
  }
}

interface FriendData {
  userId: string;
  nickName: string;
  status?: string;
}

interface UpdateFriendsListOptions {
  friends: FriendData[];
  isPending?: boolean;
}
export function updateFriendsList({
  friends,
  isPending
}: UpdateFriendsListOptions): void {
  if (!friends || friends.length === 0) {
    console.warn("Empty friend list data.");
    return;
  }

  if (isAddFriendsOpen) return;

  const friendInstances = friends.map((friendData) => new Friend(friendData));

  if (isPending) {
    let pendingCounter = 0;

    friendInstances.forEach((friend) => {
      if (friend.isPending) {
        pendingCounter += 1;
      }
    });

    if (pendingCounter > 0) {
      if (pendingAlertLeft) {
        pendingAlertLeft.textContent = String(pendingCounter);
        enableElement(pendingAlertLeft);
      }
      if (pendingAlertRight) {
        pendingAlertRight.textContent = String(pendingCounter);
        enableElement(pendingAlertRight);
      }

      setWindowName(pendingCounter);
    }

    return;
  }

  populateFriendsContainer(friendInstances, isPending);
}

export function addPendingButtons(friendButton: HTMLElement, friend: Friend) {
  if (friend.isFriendsRequestToUser) {
    const acceptButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.TickBtn,
      translations.getTranslation("accept")
    );
    acceptButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.ADD_FRIEND, friend.userId)
    );
  } else {
    const closeButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.CloseBtn,
      translations.getTranslation("cancel")
    );
    closeButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.REMOVE_FRIEND, friend.userId)
    );
  }
}

export function handleButtonClick(
  event: Event,
  action: EventType,
  userId: string
) {
  event.stopPropagation();
  apiClient.send(action, { friendId: userId });
}

export function addFriendId(userId: string) {
  apiClient.send(EventType.ADD_FRIEND_ID, { friendId: userId });
  createTooltipAtCursor(translations.getContextTranslation("ADDED_FRIEND"));
}
export function addFriend(nickName: string, discriminator: string) {
  apiClient.send(EventType.ADD_FRIEND, {
    friendName: nickName,
    friendDiscriminator: discriminator
  });
  createTooltipAtCursor(translations.getContextTranslation("ADDED_FRIEND"));
}

export function submitAddFriend() {
  const addfriendinput = getId("addfriendinputfield") as HTMLInputElement;
  const currentValue = addfriendinput.value.trim();

  if (!currentValue) return;

  if (!isValidFriendName(currentValue)) {
    printFriendMessage(
      translations.getTranslation("addFriendDiscriminatorErrorText")
    );
    return;
  }

  if (currentValue === getSelfFullDisplay()) {
    printFriendMessage(
      translations.getTranslation("friendAddYourselfErrorText")
    );
    return;
  }

  const parsed = parseUsernameDiscriminator(currentValue);
  if (!parsed) return;

  const { nickName, discriminator } = parsed;

  addFriend(nickName, discriminator);
}

export function filterFriends(): void {
  const friendsSearchInput = getId("friendsSearchInput") as HTMLInputElement;
  if (!friendsSearchInput) return;

  const input = friendsSearchInput.value.toLowerCase();
  const friends = document.getElementsByClassName("friend-card");

  for (let i = 0; i < friends.length; i++) {
    const friend = friends[i] as HTMLElement;
    const dataName = friend.getAttribute("data-name");

    if (dataName) {
      const friendName = dataName.toLowerCase();
      if (friendName.includes(input)) {
        friend.classList.add("visible");
      } else {
        friend.classList.remove("visible");
      }
    }
  }
}

export function toggleButtonState(booleanstate: boolean) {
  const addButton = getId("profile-add-friend-button");
  if (!addButton) return;
  if (booleanstate) {
    addButton.classList.add("active");
    addButton.classList.remove("inactive");
  } else {
    addButton.classList.add("inactive");
    addButton.classList.remove("active");
  }
}

function init() {
  window.addEventListener("resize", handleResize);

  const addFriButton = getId("open-friends-button");
  if (addFriButton) {
    addFriButton.addEventListener("click", openAddFriend);
  }
}

init();
