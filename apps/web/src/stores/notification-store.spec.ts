import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectNotifications,
  selectUnreadCount,
  useNotificationStore,
} from '@/stores/notification-store';
import type { AppNotification } from '@/types/notification';

function notification(id: string): AppNotification {
  return {
    id,
    userId: 'user-1',
    type: 'COMMENT',
    payload: null,
    readAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function resetStore(): void {
  useNotificationStore.setState({ notifications: [], unreadCount: 0 });
}

beforeEach(() => {
  resetStore();
});

describe('notification store', () => {
  it('starts empty', () => {
    expect(selectNotifications(useNotificationStore.getState())).toEqual([]);
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
  });

  it('prepends notifications and counts unread, deduping by id', () => {
    useNotificationStore.getState().prepend(notification('n1'));
    useNotificationStore.getState().prepend(notification('n2'));
    useNotificationStore.getState().prepend(notification('n1'));
    const ids = selectNotifications(useNotificationStore.getState()).map(
      (entry) => entry.id,
    );
    expect(ids).toEqual(['n2', 'n1']);
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(2);
  });

  it('marks a single notification read', () => {
    useNotificationStore.getState().prepend(notification('n1'));
    useNotificationStore.getState().prepend(notification('n2'));
    useNotificationStore.getState().markRead('n1');
    const notifications = selectNotifications(useNotificationStore.getState());
    expect(notifications[1].readAt).not.toBeNull();
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(1);
  });

  it('markRead is idempotent', () => {
    useNotificationStore.getState().prepend(notification('n1'));
    useNotificationStore.getState().markRead('n1');
    useNotificationStore.getState().markRead('n1');
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
  });

  it('marks everything read and clears', () => {
    useNotificationStore.getState().prepend(notification('n1'));
    useNotificationStore.getState().prepend(notification('n2'));
    useNotificationStore.getState().markAllRead();
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
    expect(
      selectNotifications(useNotificationStore.getState()).every(
        (entry) => entry.readAt !== null,
      ),
    ).toBe(true);
    useNotificationStore.getState().clear();
    expect(selectNotifications(useNotificationStore.getState())).toEqual([]);
  });
});
