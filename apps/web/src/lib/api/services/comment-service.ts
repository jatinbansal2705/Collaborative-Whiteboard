import type {
  Comment,
  CommentThread,
  CreateCommentInput,
  CreateCommentThreadInput,
} from '@/types/comment';
import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

/** Comment threads domain service. */
export const commentService = {
  async list(boardId: string): Promise<CommentThread[]> {
    const { data } = await httpClient.get<CommentThread[]>(
      API_ENDPOINTS.comments.list(boardId),
    );
    return data;
  },

  async create(
    boardId: string,
    input: CreateCommentThreadInput,
  ): Promise<CommentThread> {
    const { data } = await httpClient.post<CommentThread>(
      API_ENDPOINTS.comments.create(boardId),
      input,
    );
    return data;
  },

  async reply(threadId: string, input: CreateCommentInput): Promise<Comment> {
    const { data } = await httpClient.post<Comment>(
      API_ENDPOINTS.comments.reply(threadId),
      input,
    );
    return data;
  },

  async resolve(threadId: string, resolved: boolean): Promise<void> {
    await httpClient.post<void>(API_ENDPOINTS.comments.resolve(threadId), {
      resolved,
    });
  },
};
