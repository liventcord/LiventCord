<template>
  <div>
    <div v-if="isOnDm" id="friends-popup-container"></div>

    <Teleport to="#friends-container">
      <div ref="friendsContainerRef">
        <template v-if="isAddFriendsOpen">
          <div id="addfriendtext">{{ t("addfriendtext") }}</div>
          <div id="addfrienddetailtext">{{ t("addfrienddetailtext") }}</div>

          <div id="addfriendinputcontainer">
            <input
              id="addfriendinputfield"
              v-model="addFriendInput"
              autocomplete="off"
              :placeholder="t('addfrienddetailtext')"
            />
            <button
              id="addfriendinputbutton"
              :class="addFriendInput.trim() ? 'active' : 'inactive'"
              @click="submitAddFriend"
            >
              {{ t("addfriendinputbutton") }}
            </button>
          </div>

          <hr class="vertical-line-long" />
        </template>

        <template v-else>
          <input
            id="friendsSearchInput"
            v-model="searchInput"
            autocomplete="off"
            :placeholder="t('friendsSearchInput')"
          />

          <h2 id="friendsTitleContainer">
            {{ friendsTitle }}
          </h2>

          <template v-if="visibleFriends.length === 0">
            <div class="empty-state">
              <div class="empty-title">
                {{ t("no-friends-title") }}
              </div>
              <div class="empty-subtitle">
                {{ t("no-friends-description") }}
              </div>
            </div>
          </template>

          <template v-else>
            <div
              v-for="friend in visibleFriends"
              :key="friend.userId"
              class="friend-card visible"
              :id="friend.userId"
              :data-name="friend.nickName"
              @click="onFriendCardClick(friend)"
            >
              <span
                v-if="!isPendingMenu"
                :class="`profile-bubble ${getStatus(friend.userId)}`"
                style="transition: display 0.5s ease-in-out"
              />

              <FriendAvatar :userId="friend.userId" />

              <div class="friend-info">
                <div class="friend-name">{{ friend.nickName }}</div>
                <div class="friend-discriminator">
                  #{{ friend.discriminator }}
                </div>
                <div class="friend-status">
                  {{ getFriendStatusLabel(friend) }}
                </div>
              </div>

              <div class="friend-button">
                <template v-if="isPendingMenu">
                  <template v-if="friend.isFriendsRequestToUser">
                    <div
                      class="gray-sphere friend_button_element"
                      :title="t('accept')"
                      @click.stop="onAccept(friend.userId)"
                      v-html="SVG.tickBtn"
                    />
                    <div
                      class="gray-sphere friend_button_element"
                      :title="t('deny')"
                      @click.stop="onDeny(friend.userId)"
                      v-html="SVG.closeBtn"
                    />
                  </template>

                  <template v-else>
                    <div
                      class="gray-sphere friend_button_element"
                      :title="t('cancel')"
                      @click.stop="onCancel(friend.userId)"
                      v-html="SVG.closeBtn"
                    />
                  </template>
                </template>

                <template v-else>
                  <div
                    class="gray-sphere friend_button_element"
                    :title="t('send-message')"
                    @click.stop="onSendMessage(friend.userId)"
                    v-html="SVG.sendMsgBtn"
                  />
                  <div
                    class="gray-sphere friend_button_element"
                    :id="friend.userId + '-options'"
                    :title="t('more')"
                    @click.stop="onOptions(friend.userId)"
                    v-html="SVG.optionsBtn"
                  />
                </template>
              </div>
            </div>
          </template>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, h } from "vue";
import { apiClient, EventType } from "../ts/api";
import { setProfilePic } from "../ts/avatar";
import {
  appendToProfileContextList,
  triggerContextMenuById
} from "../ts/contextMenuActions";
import { SVG } from "../ts/svgIcons";
import { translations } from "../ts/translations";
import { Friend } from "../ts/types/interfaces";
import { userManager } from "../ts/user";
import { getId } from "../ts/utils";
import { friendsCache, submitAddFriend } from "../ts/friends";
import { isOnDm } from "../ts/router";
import { openDm } from "../ts/appUI";

export let friendsContainerInstance: InstanceType<
  typeof FriendsContainerComponent
> | null = null;

export const friendsState = {
  isAddFriendsOpen: ref(false),
  currentSelectedFriendMenu: ref<string>("online"),
  friends: ref<Friend[]>([]),
  popupMessage: ref("")
};

const FriendAvatar = defineComponent({
  name: "FriendAvatar",
  props: {
    userId: { type: String, required: true }
  },
  setup(props) {
    const imgRef = ref<HTMLImageElement | null>(null);

    async function applyAvatar() {
      if (imgRef.value) {
        await setProfilePic(imgRef.value, props.userId);
      }
    }

    onMounted(() => {
      applyAvatar();
    });

    watch(
      () => props.userId,
      () => {
        applyAvatar();
      }
    );

    return () =>
      h("img", {
        ref: imgRef,
        class: "friend-image",
        crossorigin: "anonymous"
      });
  }
});

const FriendsContainerComponent = defineComponent({
  name: "FriendsContainer",
  components: { FriendAvatar },
  setup() {
    const addFriendInput = ref("Nick#0000");
    const searchInput = ref("");
    const friendsContainerRef = ref<HTMLElement | null>(null);

    const isAddFriendsOpen = friendsState.isAddFriendsOpen;
    const currentSelectedFriendMenu = friendsState.currentSelectedFriendMenu;
    const friends = friendsState.friends;
    const popupMessage = friendsState.popupMessage;
    watch(
      friends,
      (newFriends) => {
        newFriends.forEach((friend) => {
          let cachedFriend = friendsCache.getFriend(friend.userId);

          if (cachedFriend) {
            appendToProfileContextList(cachedFriend, friend.userId);
          }
        });
      },
      { deep: true, immediate: true }
    );

    const filteredFriends = computed(() => {
      const menu = currentSelectedFriendMenu.value;

      return friends.value.filter((f) => {
        if (menu === "pending") {
          return f.isPending;
        }

        if (menu === "all") {
          return !f.isPending;
        }

        if (menu === "blocked") {
          return !f.isPending && userManager.isUserBlocked(f.userId);
        }

        if (menu === "online") {
          return (
            !f.isPending && userManager.getMemberStatus(f.userId) !== "offline"
          );
        }

        return false;
      });
    });

    const visibleFriends = computed(() => {
      const q = searchInput.value.toLowerCase();
      if (!q) return filteredFriends.value;

      return filteredFriends.value.filter((f) =>
        f.nickName.toLowerCase().includes(q)
      );
    });

    const isPendingMenu = computed(
      () => currentSelectedFriendMenu.value === "pending"
    );

    const friendsTitle = computed(() => {
      let count = filteredFriends.value.length;
      const label = translations.getTranslation(
        currentSelectedFriendMenu.value
      );
      return `${label} — ${count}`;
    });

    function t(key: string) {
      return translations.getTranslation(key);
    }

    function getStatus(userId: string): string {
      return userManager.getMemberStatus(userId);
    }

    function getFriendStatusLabel(friend: Friend): string {
      if (friend.isPending) {
        return t(
          friend.isFriendsRequestToUser
            ? "incoming-friend-request"
            : "outgoing-friend-request"
        );
      }

      return t(userManager.getMemberStatus(friend.userId));
    }

    function addFriend() {
      submitAddFriend();
    }

    function onFriendCardClick(friend: Friend) {
      openDm(friend.userId);
    }

    function onSendMessage(userId: string) {
      openDm(userId);
    }

    function onOptions(userId: string) {
      const el = getId(userId + "-options") as HTMLElement;
      if (el) triggerContextMenuById(el, userId);
    }

    function onAccept(userId: string) {
      apiClient.send(EventType.ACCEPT_FRIEND, { friendId: userId });
    }

    function onDeny(userId: string) {
      apiClient.send(EventType.DENY_FRIEND, { friendId: userId });
    }

    function onCancel(userId: string) {
      apiClient.send(EventType.REMOVE_FRIEND, { friendId: userId });
    }
    function printFriendMessage(content: string) {
      const NOTIFY_LENGTH = 10000;
      popupMessage.value = content;

      if (popupTimer) clearTimeout(popupTimer);
      popupTimer = setTimeout(() => {
        popupMessage.value = "";
        popupTimer = null;
      }, NOTIFY_LENGTH);
    }
    let popupTimer: ReturnType<typeof setTimeout> | null = null;

    watch(popupMessage, (msg) => {
      if (msg) {
        if (popupTimer) clearTimeout(popupTimer);
        popupTimer = setTimeout(() => {
          popupMessage.value = "";
          popupTimer = null;
        }, 10000);
      }
    });

    onMounted(() => {
      friendsContainerInstance = createFriendsInstance() as any;
    });

    function createFriendsInstance() {
      return {
        openAddFriend: () => {
          isAddFriendsOpen.value = true;
        },
        closeAddFriend: () => {
          isAddFriendsOpen.value = false;
        },
        updateFriends: (f: Friend[]) => {
          friends.value = f;
          friends.value.forEach((friend) => {
            const cachedFriend = friendsCache.getFriend(friend.userId);
            appendToProfileContextList(cachedFriend, friend.userId);
            console.log(cachedFriend);
          });
        },
        removeFriendCard: (userId: string) => {
          friends.value = friends.value.filter((f) => f.userId !== userId);
        },
        setMenu: (menu: string) => {
          currentSelectedFriendMenu.value = menu;
        },
        printFriendMessage: printFriendMessage
      };
    }

    return {
      addFriendInput,
      searchInput,
      friendsContainerRef,
      isAddFriendsOpen,
      filteredFriends,
      visibleFriends,
      isPendingMenu,
      friendsTitle,
      popupMessage,
      SVG,
      isOnDm,
      t,
      getStatus,
      getFriendStatusLabel,
      submitAddFriend: addFriend,
      onFriendCardClick,
      onSendMessage,
      onOptions,
      onAccept,
      onDeny,
      onCancel,
      printFriendMessage
    };
  }
});

export default FriendsContainerComponent;
</script>

<style>
#addfriendinputfield {
  flex: 1;
  height: 35px;
  color: white;
  font-size: 16px;
  background-color: #1e1f22;
  border: 1px solid transparent;
  border-radius: 10px;
  transition: border-color 0.3s ease;
  border-color: #303035;
  text-indent: 10px;
  outline: none;
  margin-left: 20px;
}

#addfriendinputfield:focus {
  border-color: #377bd3;
}
@media (max-width: 500px) {
  #addfriendinputbutton {
    width: 140px;
    font-size: 0.875rem;
    height: 40px;
  }

  #addfriendinputfield {
    height: 40px;
  }
}
#addfriendinputbutton {
  margin-left: 15px;
  color: white;
  background-color: #007bff;
  border-radius: 4px;
  font-size: 14px;
  width: 180px;
  height: 35px;
  border: none;
  cursor: pointer;
  margin-top: 10px;
  margin-left: 10px;
}
#addfriendinputbutton.inactive {
  background-color: #3b428a;
  color: #8a8b90;
  cursor: auto;
}
#addfriendinputbutton.active {
  background-color: #5865f2;
  cursor: pointer;
}

#friend-menu-buttons {
  display: flex;
  flex-wrap: nowrap;
  margin-left: -15px;
  align-items: center;
}
.friend-menu-button {
  white-space: nowrap;
  cursor: pointer;
  font-size: 16px;
  height: 28px;
  width: 100%;
  margin-top: -2px;
  margin-right: 10px;
  background-color: transparent;
  border: none;
  border-radius: 10px;
  color: #b5bac1;
  z-index: 6;
}

#addfriendtext {
  white-space: nowrap;
  color: white;
  font-weight: bold;
  text-transform: uppercase;
  margin-left: 25px;
  margin-top: 10px;
  font-size: 15px;
}
#addfrienddetailtext {
  white-space: nowrap;
  color: #949ba4;
  margin-left: 25px;
  margin-top: 0.875rem;
  font-size: 13px;
}

#friends-popup-container {
  z-index: 1;
  margin-top: 200px;
}
#friends-container {
  flex: 1;
  height: calc(100vh - 18vh);
  overflow-y: auto;
  overflow-x: hidden;
  display: block;
  width: 250px;
  padding-left: 5px;
  padding-top: 60px;
  border-bottom: 1px solid #2d3035;
  color: #dcddde;
  scroll-behavior: smooth;
}
#friends-container::-webkit-scrollbar {
  width: 8px;
}
#friends-container::-webkit-scrollbar-thumb {
  background-color: #212222;
  border-radius: 6px;
}
#friends-container::-webkit-scrollbar-track {
  background-color: #2b2d31;
}
#friendsSearchInput {
  border: none;
  width: 95%;
  height: 30px;
  color: white;
  background-color: #2e2f35;
  border: 2px solid #303035;
  border-radius: 5px;
  font-size: 16px;
  padding: 3px 3px;
  text-indent: 10px;
  margin-left: 15px;
  align-items: center;
  position: relative;
}
body .black-theme #friendsSearchInput {
  background-color: #17171a;
}
.friend-card {
  position: relative;
  display: none;
  align-items: center;
  margin-left: 15px;
  top: 60px;
  padding: 10px;
  cursor: pointer;
  background-color: transparent;
  border-radius: 8px;
  transition: background-color 0.3s ease;
  width: 95%;
}
.friend-card.visible {
  display: flex;
}
.friend-card:hover {
  background-color: #3a3b41;
}
body.black-theme .friend-card:hover {
  background-color: #242428;
}

.friend-card:not(:last-child)::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  height: 0.5px;
  background-color: #ffffff18;
}
#friends-container .friend-card:first-child::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 1px;
  background-color: #ffffff18;
}
.pendingAlert {
  display: none;
  justify-content: center;
  align-items: center;
  background-color: rgb(242, 63, 66);
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  border: none;
  font-size: 0.875rem;
  text-indent: 0;
}

#pendingAlertLeft {
  position: absolute;
  right: 10px;
}
#pendingAlertRight {
  margin-left: -3px;
  margin-right: 6px;
}
#pendingAlertMain {
  margin-top: -22px;
  margin-left: 8px;
  position: absolute;
}

.friend-image {
  border-radius: 50%;
  width: 32px;
  height: 32px;
  object-fit: cover;
  margin-right: 10px;
  transition: border-radius 0.5s ease-out;
}
.friend-name {
  font-size: 16px;
  margin-bottom: 5px;
  color: white;
  display: inline-block;
  pointer-events: none;
}
.friend-discriminator {
  margin-left: 5px;
  display: inline-block;
  pointer-events: none;
  background-color: transparent;
}
.friend-status {
  font-size: 13px;
  color: #c7c3c3;
  pointer-events: none;
}
.friend-icon,
#friend-label,
.friend-info {
  pointer-events: none;
}
.friend-container {
  border: none;
  display: flex;
  width: 140%;
  height: 44px;
  border-radius: 5px;
  margin-top: 20px;
  margin-left: -45px;
  align-items: center;
  cursor: pointer;
  pointer-events: auto;
  transition:
    background-color 0.3s,
    color 0.3s,
    box-shadow 0.3s;
}
.friend-container:hover {
  background-color: rgb(53, 55, 60);
}
.friend-container #friend-label {
  color: #949ba4;
  user-select: none;
  cursor: pointer;
  padding-top: 0px;
  padding-left: 55px;
  transition: color 0.3s;
}
.friend-container:hover #friend-label {
  color: white;
}
.friend-container #friendiconsvg {
  fill: #949ba4 !important;
}
.friend-container:hover #friendiconsvg {
  fill: white !important;
}
.friend-container.dm-selected #friendiconsvg {
  fill: white !important;
}
.friend-container.dm-selected {
  color: #fff;
}
.friend-container.dm-selected #friend-label {
  color: white;
}
#friend-icon {
  position: absolute;
  left: 93px;
  top: 65px;
  height: 30px;
  width: 30px;
}
.friend-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  cursor: pointer;
  padding: 5px;
  position: relative;
}

.friend-button .gray-sphere {
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.friend-card:hover .gray-sphere {
  background-color: #2c2d32;
}

#body .black-theme .friend-card:hover .gray-sphere {
  background-color: #111112;
}

.friend-button .gray-sphere img {
  width: 22px;
  height: 22px;
}

.friend_button_element {
  margin-left: 15px;
}
.status-bubble {
  margin-left: 30px;
  margin-top: 30px;
}
</style>
