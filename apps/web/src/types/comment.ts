/** REST shapes from the comments module (apps/api/src/modules/comments). */

export interface CommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface CommentMention {
  userId: string;
  username: string;
}

export interface Comment {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  mentions: CommentMention[];
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
}

export interface CommentThread {
  id: string;
  boardId: string;
  x: number;
  y: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByUser: CommentAuthor | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

export interface CreateCommentThreadInput {
  x: number;
  y: number;
  body: string;
}

export interface CreateCommentInput {
  body: string;
}
