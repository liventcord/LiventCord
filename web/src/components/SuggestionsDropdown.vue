<template>
  <Teleport to="#userMentionDropdown">
    <template v-if="filteredUsers.length > 0 && showDropdown">
      <div
        v-for="(user, index) in filteredUsers"
        :key="user.userId"
        class="suggestion-option"
        :class="{ 'mention-highlight': index === currentSearchUiIndex }"
        @click="selectMember(user.userId, user.nickName)"
        :data-userid="user.userId"
      >
        <img
          v-if="user.userId !== 'everyone'"
          class="profile-image"
          loading="lazy"
          style="width:24px; height: 24px;"
          width="24"
          height="24"
          alt="profile image"
          :ref="el => el && setProfilePic(el as HTMLImageElement, user.userId, true)"
        />
        <span 
          :class="{ 'user-nickname': user.userId !== 'everyone' }"
        >
          {{ user.userId === 'everyone' ? '@everyone' : user.nickName }}
        </span>
      </div>
    </template>
  </Teleport>
</template>



<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

import {
  disableElement,
  getId
} from '../ts/utils.ts'
import { Member, UserInfo } from '../ts/user.ts'
import { isOnGuild } from '../ts/router.ts'
import { cacheInterface } from '../ts/cache.ts'
import { currentGuildId } from '../ts/guild.ts'
import { getCurrentDmFriends } from '../ts/friendui.ts'
import { setProfilePic } from "../ts/avatar.ts"
import { DomUtils, getChatBarState, manuallyRenderEmojis, onMemberSelected, setChatBarState, setSuppressSend } from '../ts/chatbar.ts'
import { alertUser } from '../ts/ui.ts'

const chatInput = getId("user-input") as HTMLDivElement

const currentSearchUiIndex = ref(-1)
const showDropdown = ref(false)
const filteredUsers = ref<UserInfo[]>([])

function setDropdownDisplay() {
  const dropdown = getId('userMentionDropdown')
  if (!dropdown) return
  dropdown.style.display = (showDropdown.value && filteredUsers.value.length > 0) ? 'flex' : 'none'
}

watch([showDropdown, filteredUsers], () => {
  nextTick(() => {
    setDropdownDisplay()
  })
})

function extractUsers(): UserInfo[] {
  const seen = new Set<string>()

  const results: UserInfo[] = [
    ...(isOnGuild ? [{
      userId: 'everyone',
      nickName: 'everyone',
      discriminator: ''
    }] : [])
  ]

  if (isOnGuild) {
    const guildMembers = cacheInterface.getMembers(currentGuildId) as Member[] | undefined
    if (!guildMembers) return results

    for (const member of guildMembers) {
      if (seen.has(member.userId)) continue
      seen.add(member.userId)
      results.push({
        userId: member.userId,
        nickName: member.nickName,
        discriminator: '',
        status: member.status,
      })
    }

    return results
  }

  const dmUsers = Object.values(getCurrentDmFriends())
  for (const user of dmUsers) {
    if (seen.has(user.userId)) continue
    seen.add(user.userId)
    results.push(user)
  }

  return results
}

function updateFilteredUsers() {
  const state = getChatBarState()
  const textContent = state.rawContent
  const cursorPos = state.cursorPosition

  if (!textContent || cursorPos == null) {
    console.log('No text or cursor position is null. Clearing filtered users and hiding dropdown.')
    filteredUsers.value = []
    showDropdown.value = false
    return
  }

  const beforeCursor = textContent.slice(0, cursorPos)
  const lastAt = beforeCursor.lastIndexOf('@')


  if (lastAt === -1) {
    console.log('No "@" found before cursor. Clearing filtered users and hiding dropdown.')
    filteredUsers.value = []
    showDropdown.value = false
    return
  }

  const possibleMention = beforeCursor.slice(lastAt, cursorPos)

  if (!(possibleMention === '@' || possibleMention.match(/^@\w*$/))) {
    filteredUsers.value = []
    showDropdown.value = false
    return
  }

  const users = extractUsers()

  const everyone = users.find(user => user.userId === 'everyone')
  const normalUsers = users.filter(user => user.userId !== 'everyone')

  const rawQuery = possibleMention.toLowerCase()
  const query = rawQuery.startsWith('@') ? rawQuery.slice(1) : rawQuery
  const cleanQuery = query.trim().toLowerCase()

  const matchedUsers = cleanQuery === ''
    ? normalUsers.slice(0, 50)  // show all users if just '@'
    : normalUsers.filter(user => {
        if (typeof user.nickName !== 'string') return false
        return user.nickName.trim().toLowerCase().includes(cleanQuery)
      }).slice(0, 50)

    if (everyone && 'everyone'.startsWith(query)) {
      matchedUsers.push(everyone)
    }

    filteredUsers.value = matchedUsers

    showDropdown.value = filteredUsers.value.length > 0

    if (showDropdown.value) {
      currentSearchUiIndex.value = 0
    }
}


function selectMember(userId: string, userNick: string) {
  if (!chatInput) return

  const state = getChatBarState()
  if (!state) return 
  alertUser(state.rawContent)

  const message = state.rawContent ?? chatInput.textContent ?? ''
  let position = state.cursorPosition
  if (position < 0) position = 0
  if (position > message.length) position = message.length

  const beforeCursor = message.slice(0, position)
  const mentionStart = beforeCursor.lastIndexOf('@')

  if (mentionStart === -1) return

  const afterMention = message.slice(position)

  const newMessage =
    beforeCursor.slice(0, mentionStart) +
    `@${userNick} ` +
    afterMention

  state.rawContent = newMessage
  const newCursorPos = mentionStart + userNick.length + 2
  state.cursorPosition = newCursorPos

  const savedSelection = {
    start: newCursorPos,
    end: newCursorPos
  }

  requestAnimationFrame(() => {
    DomUtils.restoreSelection(chatInput, savedSelection)
  })

  if (newMessage)
    setChatBarState(state)

  manuallyRenderEmojis(newMessage)

  onMemberSelected(state)

  setTimeout(() => {
    disableElement("userMentionDropdown")
  }, 0)

  showDropdown.value = false
  currentSearchUiIndex.value = -1
}

function onInput(event: Event) {
  updateFilteredUsers()
}

function handleKeydown(event: KeyboardEvent) {
  const optionsLength = filteredUsers.value.length
  setDropdownDisplay()
  if (optionsLength === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    currentSearchUiIndex.value = (currentSearchUiIndex.value + 1) % optionsLength
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    currentSearchUiIndex.value = (currentSearchUiIndex.value - 1 + optionsLength) % optionsLength
  } else if (event.key === 'Enter') {
    event.preventDefault()

    if (filteredUsers.value.length === 0) {
      setSuppressSend(false)
      showDropdown.value = false
      currentSearchUiIndex.value = -1
      return
    }

    if (currentSearchUiIndex.value < 0 || currentSearchUiIndex.value >= optionsLength) {
      currentSearchUiIndex.value = 0
    }

    const user = filteredUsers.value[currentSearchUiIndex.value]

    setSuppressSend(true)
    selectMember(user.userId, user.nickName)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    showDropdown.value = false
    currentSearchUiIndex.value = -1
  }
}


chatInput.addEventListener('input', onInput)
chatInput.addEventListener('keydown', handleKeydown)

document.addEventListener('click', (event) => {
  const dropdown = document.getElementById('userMentionDropdown')
  const target = event.target as HTMLElement

  if (dropdown && !dropdown.contains(target) && target !== chatInput) {
    showDropdown.value = false
    currentSearchUiIndex.value = -1
  }
})

let usersRefreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  setTimeout(() => {
    updateFilteredUsers()
  }, 1000)

  nextTick(() => {
    setDropdownDisplay()
  })
})

onBeforeUnmount(() => {
  if (usersRefreshInterval) clearInterval(usersRefreshInterval)
})
</script>

<style scoped>
.user-nickname {
  margin-left: 10px;
}
</style>