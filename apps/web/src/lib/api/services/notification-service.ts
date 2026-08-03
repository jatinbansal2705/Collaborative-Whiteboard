import type { NotificationListResult } from '@/types/notification';
import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

/** In-app notification domain service. */
export const notificationService = {
  async list(
    query: { cursor?: string; limit?: number } = {},
  ): Promise<NotificationListResult> {
    const { data } = await httpClient.get<NotificationListResult>(
      API_ENDPOINTS.notifications.list,
      { query },
    );
    return data;
  },

  async markRead(id: string): Promise<void> {
    await httpClient.patch<void>(API_ENDPOINTS.notifications.read(id));
  },

  async markAllRead(): Promise<void> {
    await httpClient.patch<void>(API_ENDPOINTS.notifications.readAll);
  },
};
