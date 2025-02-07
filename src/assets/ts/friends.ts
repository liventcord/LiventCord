import {
  disableElement,
  reCalculateFriTitle,
  enableElement,
  setWindowName,
  parseUsernameDiscriminator,
  getId,
  isValidFriendName
} from "./utils.ts";
import { getSelfFullDisplay, currentUserId } from "./user.ts";
import { handleResize } from "./ui.ts";
import {
  populateFriendsContainer,
  friendsContainer,
  isAddFriendsOpen,
  openAddFriend,
  printFriendMessage,
  ButtonTypes,
  createButtonWithBubblesImg
} from "./friendui.ts";
import { translations } from "./translations.ts";
import { apiClient, EventType } from "./api.ts";

const pendingAlertRight = getId("pendingAlertRight");
const pendingAlertLeft = getId("pendingAlertLeft");

export const offline = "offline";
export const online = "online";
export const all = "all";
export const pending = "pending";
export const blocked = "blocked";

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
  status: string;
  isOnline: boolean;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isFriendRequestToUser: boolean;
}

export class Friend {
  userId: string;
  name: string;
  discriminator: string;
  status: string;
  isOnline: boolean;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isFriendRequestToUser: boolean;

  constructor(friend: FriendData) {
    this.userId = friend.userId;
    this.name = friend.nickName;
    this.discriminator = friend.discriminator;
    this.status = friend.status;
    this.isOnline = friend.isOnline;
    this.description = friend.description;
    this.createdAt = friend.createdAt;
    this.lastLogin = friend.lastLogin;
    this.socialMediaLinks = friend.socialMediaLinks;
    this.isFriendRequestToUser = friend.isFriendRequestToUser;
  }

  isPending(): boolean {
    return this.isFriendRequestToUser;
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
    this.friendsCache = initData;
    populateFriendsContainer(this.friendsCache);
  }

  addFriend(friend: Friend) {
    this.friendsCache[friend.userId] = friend;
  }

  isFriend(userId: string): boolean {
    return userId !== currentUserId && userId in this.friendsCache;
  }

  userExistsDm(userId: string): boolean {
    return userId in this.dmFriends;
  }

  getFriendDiscriminator(friendId: string): string | undefined {
    const friend = this.friendsCache[friendId];
    return friend ? friend.discriminator : undefined;
  }

  isOnline(userId: string): boolean {
    return !!this.friendsCache[userId]?.isOnline;
  }
}
export const friendsCache = new FriendsCache();

//actions

export function getFriendMessage(userNick, isSuccess, errorType) {
  if (isSuccess) {
    return translations.replacePlaceholder(errorType, { userNick });
  } else {
    return translations.getFriendErrorMessage(errorType);
  }
}

export function displayFriendActionMessage(userNick, isSuccess, errorType) {
  const text = isSuccess
    ? getFriendMessage(userNick, isSuccess, errorType)
    : getFriendMessage(userNick, false, errorType);

  printFriendMessage(text);
}

export function handleAddFriendResponse(message) {
  const { userId, userNick, user_data, isSuccess } = message;
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_FRIEND_REQUEST_EXISTS
  );
}

export function handleAcceptFriendRequestResponse(message) {
  const { userId, userNick, user_data, isSuccess } = message;
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_ALREADY_ACCEPTED
  );

  if (isSuccess) {
    friendsCache[userId] = user_data;
    disableElement(pendingAlertRight);
    disableElement(pendingAlertLeft);
    document.title = "LiventCord";
  }
}

export function handleRemoveFriendResponse(message) {
  const { userId, userNick, isSuccess } = message;
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_NOT_FRIENDS
  );

  if (isSuccess) {
    const friCard = friendsContainer.querySelector(`#${CSS.escape(userId)}`);
    if (friCard) {
      friCard.remove();
    }
    reCalculateFriTitle();
  }
}

export function handleDenyFriendRequestResponse(message) {
  const { userId, userNick, isSuccess } = message;
  displayFriendActionMessage(
    userNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_NOT_SENT
  );
}

export function handleFriendEventResponse(message) {
  const { type } = message;

  switch (type) {
    case "add_friend":
    case "add_friend_request_id":
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

export function updateFriendsList(friends, isPending?: boolean) {
  if (!friends) {
    console.warn("Empty friend list data.");
    return;
  }

  if (isAddFriendsOpen) return;

  const friendInstances = friends.map((friend) => new Friend(friend));

  if (isPending) {
    let pendingCounter = 0;
    friendInstances.forEach((friend) => {
      if (friend.isPending()) {
        pendingCounter += 1;
      }
    });

    if (pendingCounter > 0) {
      getId(pendingAlertLeft).textContent = String(pendingCounter);
      enableElement(pendingAlertLeft);
      getId(pendingAlertRight).textContent = String(pendingCounter);
      enableElement(pendingAlertRight);
      setWindowName(pendingCounter);
    }

    return;
  }

  populateFriendsContainer(friendInstances, isPending);
}

export function addPendingButtons(friendButton, friend) {
  if (friend.isFriendsRequestsToUser) {
    const acceptButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.TickBtn,
      translations.getTranslation("accept")
    );
    acceptButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.ADD_FRIEND, friend)
    );
  } else {
    const closeButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.CloseBtn,
      translations.getTranslation("cancel")
    );
    closeButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.REMOVE_FRIEND, friend)
    );
  }
}

export function handleButtonClick(event, action, friend) {
  event.stopPropagation();
  apiClient.send(action, { friendId: friend.userId });
}

export function addFriend(userId) {
  apiClient.send(EventType.ADD_FRIEND_ID, { friendId: userId });
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

  apiClient.send(EventType.ADD_FRIEND, {
    friendName: nickName,
    friendDiscriminator: discriminator
  });
}

export function filterFriends() {
  const friendsSearchInput = getId("friendsSearchInput") as HTMLInputElement;
  if (!friendsSearchInput) return;
  const input = friendsSearchInput.value.toLowerCase();
  const friends = document.getElementsByClassName("friend-card");

  for (let i = 0; i < friends.length; i++) {
    const friendName = friends[i].getAttribute("data-name").toLowerCase();
    if (friendName.includes(input)) {
      friends[i].classList.add("visible");
    } else {
      friends[i].classList.remove("visible");
    }
  }
}

export function toggleButtonState(booleanstate) {
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
