import { apiClient, EventType } from "./api";
import { guildCache } from "./cache";
import { newMessagesBar } from "./chatbar";

interface GuildUnreadCountItem {
  channelId: string;
  count: number;
}

class ReadStatusManager {
  private store: any;

  constructor() {
    setTimeout(async () => {
      const module = await import("../store");
      this.store = module.default;
      this.registerHandlers();
    }, 0);
  }

  private registerHandlers() {
    const store = this.store;

    apiClient.on(EventType.READ_CHANNEL, (data: any) => {
      store.commit("setChannelRead", {
        channelId: data.channelId,
        lastRead: data.lastRead
      });
    });

    apiClient.on(EventType.READ_GUILD, (data: any) => {
      if (!data.guildId) {
        console.error("No guild found on read");
        return;
      }
      store.commit("setGuildRead", { guildId: data.guildId });
      apiClient.send(EventType.GET_GUILD_UNREAD_COUNTS, {
        guildId: data.guildId
      });
    });
    apiClient.on(EventType.GET_CHANNEL_READ_STATE, (data: any) => {
      store.commit("setChannelRead", {
        channelId: data.channelId,
        lastRead: data.lastRead
      });
    });

    apiClient.on(EventType.GET_CHANNEL_UNREAD_COUNT, (data: any) => {
      store.commit("setChannelUnreadCount", {
        channelId: data.channelId,
        count: data
      });
    });

    apiClient.on(
      EventType.GET_GUILD_UNREAD_COUNTS,
      (data: GuildUnreadCountItem[], guildId?: string) => {
        if (!data || data.length === 0) {
          store.commit("resetGuildUnread", { guildId });
          return;
        }

        data.forEach((item) => {
          store.commit("setChannelUnreadCount", {
            channelId: item.channelId,
            count: item.count
          });
        });
      }
    );
  }

  public onNewMessage(
    guildId: string,
    channelId: string,
    isSentBySelf: boolean,
    date: string
  ) {
    const store = this.store;
    if (!store) return;

    if (isSentBySelf) {
      store.commit("setChannelRead", {
        channelId,
        lastRead: new Date(date).getTime()
      });
      store.commit("setChannelUnreadCount", { channelId, count: 0 });
      return;
    }

    if (channelId === guildCache.currentChannelId) {
      store.commit("setChannelRead", {
        channelId,
        lastRead: new Date().getTime()
      });
      store.commit("setChannelUnreadCount", { channelId, count: 0 });
      apiClient.send(EventType.READ_CHANNEL, { channelId });
    } else {
      const channel = store.state.channels.find(
        (c: any) => c.channelId === channelId
      );
      const currentUnread = channel ? channel.unreadCount : 0;
      store.commit("setChannelUnreadCount", {
        channelId,
        count: currentUnread + 1
      });
    }

    if (guildId) {
      apiClient.send(EventType.GET_GUILD_UNREAD_COUNTS, { guildId });
    }
  }
}

export const readStatusManager = new ReadStatusManager();

export function readGuildMessages(guildId: string): void {
  if (!guildId) return;
  apiClient.send(EventType.READ_GUILD, { guildId });
}

export function readCurrentMessages(channelId: string): void {
  if (!channelId) return;
  apiClient.send(EventType.READ_CHANNEL, { channelId });
  newMessagesBar.style.display = "none";
}
