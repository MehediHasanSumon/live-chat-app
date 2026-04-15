import { create } from "zustand";

export type AuthStoreUser = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  email_verified_at: string | null;
  phone: string | null;
  status: "active" | "suspended" | "deleted";
  last_seen_at: string | null;
  avatar_object_id: number | null;
};

export type AuthStoreSettings = {
  theme: "system" | "light" | "dark";
  show_active_status: boolean;
  allow_message_requests: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  vibrate_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
} | null;

type AuthStoreState = {
  user: AuthStoreUser | null;
  settings: AuthStoreSettings;
  setAuthenticated: (payload: {
    user: AuthStoreUser;
    settings: AuthStoreSettings;
  }) => void;
  clearAuthenticated: () => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  settings: null,
  setAuthenticated: ({ user, settings }) =>
    set({
      user,
      settings,
    }),
  clearAuthenticated: () =>
    set({
      user: null,
      settings: null,
    }),
}));
