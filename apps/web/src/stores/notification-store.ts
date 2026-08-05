import { create } from 'zustand';
import type { AppNotification } from '@/types/notification';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (
    notifications: AppNotification[],
    unreadCount: number,
  ) => void;
  prepend: (notification: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

/** In-app notifications for the current user. */
export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications, unreadCount) =>
    set({ notifications, unreadCount }),
  prepend: (notification) =>
    set((state) =>
      state.notifications.some((entry) => entry.id === notification.id)
        ? state
        : {
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          },
    ),
  markRead: (id) =>
    set((state) => {
      const target = state.notifications.find((entry) => entry.id === id);
      const alreadyRead =
        target?.readAt !== null && target?.readAt !== undefined;
      if (target === undefined || alreadyRead) {
        return state;
      }
      return {
        notifications: state.notifications.map((entry) =>
          entry.id === id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((entry) => ({
        ...entry,
        readAt: entry.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

export const selectNotifications = (
  state: NotificationState,
): AppNotification[] => state.notifications;
export const selectUnreadCount = (state: NotificationState): number =>
  state.unreadCount;
