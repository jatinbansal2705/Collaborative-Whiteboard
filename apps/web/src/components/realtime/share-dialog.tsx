'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { boardService } from '@/lib/api/services/board-service';
import { roleRank } from '@/lib/board-permissions';
import { userColor, userInitials } from '@/lib/realtime/presence-ui';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/stores/toast-store';
import type {
  BoardMember,
  BoardMemberRole,
  BoardRosterItem,
} from '@/types/board';
import { useRealtimeStore } from '@/stores/realtime-store';

const ROLE_OPTIONS: BoardMemberRole[] = [
  'OWNER',
  'EDITOR',
  'COMMENTER',
  'VIEWER',
];

interface ShareDialogProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isMember(item: BoardRosterItem): item is BoardMember {
  return 'userId' in item;
}

/** Invite members, manage roles and leave the board. */
export function ShareDialog({ boardId, open, onOpenChange }: ShareDialogProps) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const myRole = useRealtimeStore(
    (state) =>
      state.presence.find((member) => member.userId === currentUser?.id)?.role,
  );
  const effectiveRole = myRole ?? 'VIEWER';
  const isOwner = roleRank(effectiveRole) >= 4;
  const canManage = roleRank(effectiveRole) >= 3;

  const [members, setMembers] = useState<BoardRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardMemberRole>('VIEWER');
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async (): Promise<void> => {
    try {
      const roster = await boardService.listMembers(boardId);
      setMembers(roster);
    } catch {
      toast.error('Could not load members');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    void loadMembers();
  }, [open, boardId, loadMembers]);

  const handleInvite = useCallback(async (): Promise<void> => {
    const trimmed = email.trim();
    if (trimmed.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      await boardService.addMember(boardId, { email: trimmed, role });
      setEmail('');
      await loadMembers();
      toast.success('Invite sent');
    } catch {
      toast.error('Could not invite member');
    } finally {
      setBusy(false);
    }
  }, [boardId, email, role, busy, loadMembers]);

  const handleRoleChange = useCallback(
    async (member: BoardMember, nextRole: BoardMemberRole): Promise<void> => {
      try {
        await boardService.updateMemberRole(boardId, member.userId, nextRole);
        await loadMembers();
      } catch {
        toast.error('Could not update role');
      }
    },
    [boardId, loadMembers],
  );

  const handleRemove = useCallback(
    async (member: BoardMember): Promise<void> => {
      try {
        await boardService.removeMember(boardId, member.userId);
        await loadMembers();
        toast.success('Member removed');
      } catch {
        toast.error('Could not remove member');
      }
    },
    [boardId, loadMembers],
  );

  const handleLeave = useCallback(async (): Promise<void> => {
    try {
      await boardService.leave(boardId);
      onOpenChange(false);
      router.replace('/');
    } catch {
      toast.error('Could not leave board');
    }
  }, [boardId, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
          <DialogDescription>
            Invite people by email and set their access level.
          </DialogDescription>
        </DialogHeader>

        {canManage ? (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="text-xs">
                Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@example.com"
                className="h-9"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label htmlFor="invite-role" className="text-xs">
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as BoardMemberRole)}
              >
                <SelectTrigger id="invite-role" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="icon"
              onClick={() => void handleInvite()}
              disabled={busy || email.trim().length === 0}
              aria-label="Invite member"
              className="h-9"
            >
              <UserPlus aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <div className="max-h-64 overflow-y-auto rounded-md border">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">
              Loading members…
            </p>
          ) : members.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {members.map((item) =>
                isMember(item) ? (
                  <li key={item.userId} className="flex items-center gap-2 p-2">
                    <Avatar className="size-8">
                      {item.avatarUrl !== null ? (
                        <AvatarImage src={item.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback
                        style={{
                          backgroundColor: `${userColor(item.userId)}26`,
                          color: userColor(item.userId),
                        }}
                      >
                        {userInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.name ?? item.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.email}
                      </p>
                    </div>
                    {isOwner ? (
                      <Select
                        value={item.role}
                        onValueChange={(value) =>
                          void handleRoleChange(item, value as BoardMemberRole)
                        }
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {item.role}
                      </span>
                    )}
                    {isOwner && item.userId !== currentUser?.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => void handleRemove(item)}
                        aria-label={`Remove ${item.name ?? item.email}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ) : (
                  <li key={item.id} className="flex items-center gap-2 p-2">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-muted-foreground">
                        @
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pending invite · {item.role}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="outline" onClick={() => void handleLeave()}>
            <LogOut aria-hidden="true" />
            Leave board
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
