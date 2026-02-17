import { UserStatus } from "./status";

export interface User {
  userId: string;
  nickname: string;
  status: string;
  discriminator: string;
  maskedEmail: string;
  email: string;
  maxAvatarSize: number;
  profileVersion: string;
}

export interface InitialState {
  user: User;
  ownerId: string;
  permissionsMap: Map<string, any>;
  guilds: any[];
  mediaWorkerUrl: string;
  maxAvatarSize: number;
  maxAttachmentSize: number;
  sharedGuildsMap: Map<string, any>;
  wsUrl: string;
  rtcWsUrl: string;
}

export type AppState = {
  currentUserId: string | null;
  currentUserNick: string | null;
  currentDiscriminator: string | null;
  userStatus: UserStatus | null;
};

const listeners = new Set<(state: AppState) => void>();

let state: AppState = {
  currentUserId: null,
  currentUserNick: null,
  currentDiscriminator: null,
  userStatus: null
};

let initialState: InitialState | null = null;

export const appState = {
  get currentUserId(): string | null {
    return state.currentUserId;
  },
  get currentUserNick(): string | null {
    return state.currentUserNick;
  },
  get currentDiscriminator(): string | null {
    return state.currentDiscriminator;
  },
  get userStatus(): UserStatus | null {
    return state.userStatus;
  },
  get(): AppState {
    return state;
  },
  set(partial: Partial<AppState>): void {
    state = { ...state, ...partial };
    listeners.forEach((l) => l(state));
  },
  reset(): void {
    state = {
      currentUserId: null,
      currentUserNick: null,
      currentDiscriminator: null,
      userStatus: null
    };
    listeners.forEach((l) => l(state));
  },
  subscribe(listener: (state: AppState) => void): () => void {
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  },
  getInitialState(): InitialState | null {
    return initialState;
  },
  initialiseState(data: Omit<InitialState, "user"> & { user: User }): void {
    initialState = { ...data };

    state.currentUserId = data.user.userId;
    state.currentUserNick = data.user.nickname;
    state.currentDiscriminator = data.user.discriminator;
    state.userStatus = null;

    listeners.forEach((l) => l(state));
  }
};
