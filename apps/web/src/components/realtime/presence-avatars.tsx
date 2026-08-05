'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userColor, userInitials } from '@/lib/realtime/presence-ui';
import { useRealtimeStore } from '@/stores/realtime-store';
import { cn } from '@/lib/utils';

const MAX_AVATARS = 4;

/**
 * Compact presence indicator: connection dot plus a stacked avatar group of
 * the members currently in the board room.
 */
export function PresenceAvatars() {
  const presence = useRealtimeStore((state) => state.presence);
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const visible = presence.slice(0, MAX_AVATARS);
  const extra = Math.max(0, presence.length - MAX_AVATARS);
  const names = presence.map((member) => member.name ?? 'Guest').join(', ');

  return (
    <div
      className="flex items-center gap-2"
      title={names.length > 0 ? names : 'No members online'}
    >
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          connected ? 'bg-emerald-500' : 'bg-amber-400',
        )}
        title={connected ? 'Connected' : 'Reconnecting…'}
        aria-label={connected ? 'Connected' : 'Reconnecting'}
      />
      <div className="flex -space-x-2">
        {visible.map((member) => {
          const color = userColor(member.userId);
          return (
            <Avatar
              key={member.userId}
              className="ring-background ring-2"
              title={member.name ?? 'Guest'}
            >
              {member.avatarUrl !== null ? (
                <AvatarImage
                  src={member.avatarUrl}
                  alt={member.name ?? 'Member'}
                />
              ) : null}
              <AvatarFallback
                style={{
                  backgroundColor: `${color}26`,
                  color,
                }}
              >
                {userInitials(member.name)}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </div>
      {extra > 0 ? (
        <span className="text-xs text-muted-foreground">+{extra}</span>
      ) : null}
    </div>
  );
}
