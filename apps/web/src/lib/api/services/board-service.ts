import type {
  CreateBoardInput,
  UpdateBoardInput,
} from '@/lib/validators/board';
import type {
  AddMemberResult,
  BoardActivityListResult,
  BoardData,
  BoardDeleted,
  BoardDetail,
  BoardListResult,
  BoardMember,
  BoardMemberRole,
  BoardRosterItem,
  BoardSummary,
  BoardVersionDetail,
  BoardVersionListResult,
  FavouriteStatus,
  ListBoardsQuery,
  SaveBoardDataResult,
} from '@/types/board';
import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

/** Board management domain service. */
export const boardService = {
  async list(query: ListBoardsQuery = {}): Promise<BoardListResult> {
    const { data } = await httpClient.get<BoardListResult>(
      API_ENDPOINTS.boards.list,
      { query },
    );
    return data;
  },

  async create(input: CreateBoardInput): Promise<BoardSummary> {
    const { data } = await httpClient.post<BoardSummary>(
      API_ENDPOINTS.boards.create,
      input,
    );
    return data;
  },

  async get(id: string): Promise<BoardDetail> {
    const { data } = await httpClient.get<BoardDetail>(
      API_ENDPOINTS.boards.detail(id),
    );
    return data;
  },

  async update(id: string, input: UpdateBoardInput): Promise<BoardSummary> {
    const { data } = await httpClient.patch<BoardSummary>(
      API_ENDPOINTS.boards.update(id),
      input,
    );
    return data;
  },

  async remove(id: string): Promise<BoardDeleted> {
    const { data } = await httpClient.delete<BoardDeleted>(
      API_ENDPOINTS.boards.remove(id),
    );
    return data;
  },

  async duplicate(id: string): Promise<BoardSummary> {
    const { data } = await httpClient.post<BoardSummary>(
      API_ENDPOINTS.boards.duplicate(id),
    );
    return data;
  },

  async archive(id: string): Promise<BoardSummary> {
    const { data } = await httpClient.patch<BoardSummary>(
      API_ENDPOINTS.boards.archive(id),
    );
    return data;
  },

  async restore(id: string): Promise<BoardSummary> {
    const { data } = await httpClient.patch<BoardSummary>(
      API_ENDPOINTS.boards.restore(id),
    );
    return data;
  },

  async setFavourite(id: string, favourite: boolean): Promise<FavouriteStatus> {
    if (favourite) {
      const { data } = await httpClient.post<FavouriteStatus>(
        API_ENDPOINTS.boards.favourite(id),
        { favourite },
      );
      return data;
    }
    const { data } = await httpClient.delete<FavouriteStatus>(
      API_ENDPOINTS.boards.unfavourite(id),
    );
    return data;
  },

  async listTemplates(): Promise<BoardSummary[]> {
    const { data } = await httpClient.get<BoardSummary[]>(
      API_ENDPOINTS.boards.templates,
    );
    return data;
  },

  async listMembers(id: string): Promise<BoardRosterItem[]> {
    const { data } = await httpClient.get<BoardRosterItem[]>(
      API_ENDPOINTS.boards.members(id),
    );
    return data;
  },

  async addMember(
    id: string,
    input: { userId?: string; email?: string; role?: BoardMemberRole },
  ): Promise<AddMemberResult> {
    const { data } = await httpClient.post<AddMemberResult>(
      API_ENDPOINTS.boards.members(id),
      input,
    );
    return data;
  },

  async updateMemberRole(
    boardId: string,
    userId: string,
    role: BoardMemberRole,
  ): Promise<BoardMember> {
    const { data } = await httpClient.patch<BoardMember>(
      API_ENDPOINTS.boards.memberRole(boardId, userId),
      { role },
    );
    return data;
  },

  async leave(id: string): Promise<void> {
    await httpClient.delete<void>(API_ENDPOINTS.boards.leave(id));
  },

  async removeMember(boardId: string, userId: string): Promise<void> {
    await httpClient.delete<void>(
      API_ENDPOINTS.boards.removeMember(boardId, userId),
    );
  },

  // ---------------------------------------------------------------------------
  // Document persistence (autosave, version history, activity)
  // ---------------------------------------------------------------------------

  async getData(id: string): Promise<BoardData> {
    const { data } = await httpClient.get<BoardData>(
      API_ENDPOINTS.boards.data(id),
    );
    return data;
  },

  /** Persists a document snapshot under optimistic concurrency. */
  async saveData(
    id: string,
    input: { data: Record<string, unknown>; baseRevision?: number },
  ): Promise<SaveBoardDataResult> {
    const { data } = await httpClient.patch<SaveBoardDataResult>(
      API_ENDPOINTS.boards.data(id),
      input,
    );
    return data;
  },

  async listVersions(
    id: string,
    query: { cursor?: string; limit?: number } = {},
  ): Promise<BoardVersionListResult> {
    const { data } = await httpClient.get<BoardVersionListResult>(
      API_ENDPOINTS.boards.versions(id),
      { query },
    );
    return data;
  },

  async getVersion(id: string, versionNo: number): Promise<BoardVersionDetail> {
    const { data } = await httpClient.get<BoardVersionDetail>(
      API_ENDPOINTS.boards.version(id, String(versionNo)),
    );
    return data;
  },

  /** Creates a manual checkpoint from the current server state. */
  async createVersion(
    id: string,
    input: { note?: string } = {},
  ): Promise<SaveBoardDataResult> {
    const { data } = await httpClient.post<SaveBoardDataResult>(
      API_ENDPOINTS.boards.versions(id),
      input,
    );
    return data;
  },

  async restoreVersion(
    id: string,
    versionNo: number,
  ): Promise<BoardVersionDetail> {
    const { data } = await httpClient.post<BoardVersionDetail>(
      API_ENDPOINTS.boards.versionRestore(id, String(versionNo)),
    );
    return data;
  },

  async listActivity(
    id: string,
    query: { before?: string; limit?: number } = {},
  ): Promise<BoardActivityListResult> {
    const { data } = await httpClient.get<BoardActivityListResult>(
      API_ENDPOINTS.boards.activity(id),
      { query },
    );
    return data;
  },
};
