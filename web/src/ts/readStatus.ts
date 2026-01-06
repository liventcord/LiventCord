import store from "../store";
import { apiClient, EventType } from "./api";
import { guildCache } from "./cache";
interface GuildUnreadCountItem {
  channelId: string;
  count: number;
}

class ReadStatusManager {
  private store: any;

  constructor() {
    this.store = store;
    setTimeout(() => {
      this.registerHandlers();
    }, 0);
  }
  private registerHandlers() {
    apiClient.on(EventType.READ_CHANNEL, (data: any) => {
      this.store.commit("setChannelRead", {
        channelId: data.channelId,
        lastRead: data.lastRead
      });
    });

    apiClient.on(EventType.READ_GUILD, (data: any) => {
      this.store.commit("setGuildRead", { guildId: data.guildId });
      apiClient.send(EventType.GET_GUILD_UNREAD_COUNTS, {
        guildId: data.guildId
      });
    });

    apiClient.on(EventType.GET_CHANNEL_READ_STATE, (data: any) => {
      this.store.commit("setChannelRead", {
        channelId: data.channelId,
        lastRead: data.lastRead
      });
    });

    apiClient.on(EventType.GET_CHANNEL_UNREAD_COUNT, (data: any) => {
      this.store.commit("setChannelUnreadCount", {
        channelId: data.channelId,
        count: data
      });
    });

    apiClient.on(
      EventType.GET_GUILD_UNREAD_COUNTS,
      (data: GuildUnreadCountItem[], guildId?: string) => {
        if (!data || data.length === 0) {
          this.store.commit("resetGuildUnread", { guildId });
          return;
        }

        data.forEach((item) => {
          this.store.commit("setChannelUnreadCount", {
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
    if (isSentBySelf) {
      this.store.commit("setChannelRead", {
        channelId,
        lastRead: new Date(date).getTime()
      });
      this.store.commit("setChannelUnreadCount", {
        channelId,
        count: 0
      });
      return;
    }

    if (channelId === guildCache.currentChannelId) {
      this.store.commit("setChannelRead", {
        channelId,
        lastRead: new Date().getTime()
      });
      this.store.commit("setChannelUnreadCount", {
        channelId,
        count: 0
      });
      apiClient.send(EventType.READ_CHANNEL, { channelId });
    } else {
      const channel = this.store.state.channels.find(
        (c: any) => c.channelId === channelId
      );
      const currentUnread = channel ? channel.unreadCount : 0;
      this.store.commit("setChannelUnreadCount", {
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
