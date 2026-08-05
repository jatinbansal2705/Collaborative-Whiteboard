'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notificationService } from '@/lib/api/services/notification-service';
import {
  selectNotifications,
  selectUnreadCount,
  useNotificationStore,
} from '@/stores/notification-store';
import { toast } from '@/stores/toast-store';
import type { AppNotification } from '@/types/notification';

const TYPE_LABELS: Record<string, string> = {
  INVITE: 'Board invitation',
  COMMENT: 'New comment',
  MENTION: 'You were mentioned',
  BOARD_SHARED: 'Board shared with you',
  CHAT_MENTION: 'Chat mention',
};

function describe(notification: AppNotification): string {
  const label = TYPE_LABELS[notification.type] ?? 'Notification';
  const title =
    typeof notification.payload?.boardTitle === 'string'
      ? ` · ${notification.payload.boardTitle}`
      : '';
  return `${label}${title}`;
}

/** Notification bell with an unread badge and dropdown list. */
export function NotificationBell() {
  const notifications = useNotificationStore(selectNotifications);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await notificationService.list({ limit: 20 });
      useNotificationStore
        .getState()
        .setNotifications(
          result.data,
          result.data.filter((notification) => notification.readAt === null)
            .length,
        );
    } catch {
      toast.error('Could not load notifications');
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const handleMarkRead = useCallback(
    async (notification: AppNotification): Promise<void> => {
      useNotificationStore.getState().markRead(notification.id);
      try {
        await notificationService.markRead(notification.id);
      } catch {
        toast.error('Could not update notification');
      }
    },
    [],
  );

  const handleMarkAllRead = useCallback(async (): Promise<void> => {
    useNotificationStore.getState().markAllRead();
    try {
      await notificationService.markAllRead();
    } catch {
      toast.error('Could not update notifications');
    }
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative size-8"
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="text-xs text-muted-foreground hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className="hover:bg-accent flex w-full items-start gap-2 px-3 py-2 text-left"
                    onClick={() => void handleMarkRead(notification)}
                  >
                    <span
                      className={
                        notification.readAt === null
                          ? 'bg-primary mt-1.5 size-2 shrink-0 rounded-full'
                          : 'mt-1.5 size-2 shrink-0 rounded-full bg-transparent'
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {describe(notification)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
