import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NotificationBell } from '@/components/realtime/notification-bell';
import { notificationService } from '@/lib/api/services/notification-service';
import { useNotificationStore } from '@/stores/notification-store';
import type { AppNotification } from '@/types/notification';

vi.mock('@/lib/api/services/notification-service', () => ({
  notificationService: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function notification(id: string, read = false): AppNotification {
  return {
    id,
    userId: 'user-1',
    type: 'COMMENT',
    payload: { boardTitle: 'Roadmap' },
    readAt: read ? '2026-01-02T00:00:00.000Z' : null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => new ResizeObserverStub()),
  );
  vi.mocked(notificationService.list).mockResolvedValue({
    data: [notification('n1'), notification('n2', true)],
    meta: {
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: null,
      prevCursor: null,
    },
  });
  vi.mocked(notificationService.markAllRead).mockResolvedValue(undefined);
  vi.mocked(notificationService.markRead).mockResolvedValue(undefined);
  useNotificationStore.setState({
    notifications: [notification('n1')],
    unreadCount: 1,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useNotificationStore.setState({ notifications: [], unreadCount: 0 });
});

describe('NotificationBell', () => {
  it('labels the trigger with the unread count', () => {
    render(<NotificationBell />);
    expect(
      screen.getByRole('button', { name: 'Notifications (1 unread)' }),
    ).toBeTruthy();
  });

  it('shows no unread suffix when the inbox is clear', () => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('loads notifications when opened', async () => {
    render(<NotificationBell />);
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Notifications (1 unread)' }),
      { key: 'Enter' },
    );

    await waitFor(() => {
      expect(notificationService.list).toHaveBeenCalled();
    });
  });

  it('marks every notification read', async () => {
    render(<NotificationBell />);
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Notifications (1 unread)' }),
      { key: 'Enter' },
    );

    const markAll = await screen.findByRole('button', {
      name: 'Mark all read',
    });
    fireEvent.click(markAll);

    await waitFor(() => {
      expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
    });
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
