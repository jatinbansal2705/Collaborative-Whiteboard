import { boardIdSchema } from '@whiteboard/shared';
import { z } from 'zod';
import {
  BOARD_LIST_DEFAULT_LIMIT,
  BOARD_LIST_MAX_LIMIT,
  BOARD_SEARCH_MAX_LENGTH,
  BOARD_TITLE_MAX_LENGTH,
  THUMBNAIL_URL_MAX_LENGTH,
} from './constants';

/** Board title policy mirrored from `CreateBoardDto` / `UpdateBoardDto`. */
export const boardTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(
    BOARD_TITLE_MAX_LENGTH,
    `Title must be at most ${BOARD_TITLE_MAX_LENGTH} characters`,
  );

export const boardDataSchema = z.record(z.string(), z.unknown());

export const createBoardSchema = z
  .object({
    title: boardTitleSchema.optional(),
    templateId: boardIdSchema.optional(),
    data: boardDataSchema.optional(),
  })
  .refine(
    (values) => values.title !== undefined || values.templateId !== undefined,
    {
      message: 'Provide a title or select a template',
      path: ['title'],
    },
  );

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

/** Title-only create form used by the dashboard "New board" dialog. */
export const blankBoardSchema = z.object({
  title: boardTitleSchema,
});

export type BlankBoardInput = z.infer<typeof blankBoardSchema>;

export const updateBoardSchema = z
  .object({
    title: boardTitleSchema.optional(),
    thumbnailUrl: z
      .string()
      .trim()
      .url('Enter a valid URL')
      .max(THUMBNAIL_URL_MAX_LENGTH)
      .optional(),
    data: boardDataSchema.optional(),
  })
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

/** Title-only rename used by the dashboard rename dialog. */
export const renameBoardSchema = z.object({
  title: boardTitleSchema,
});

export type RenameBoardInput = z.infer<typeof renameBoardSchema>;

export const boardTabSchema = z.enum(['recent', 'shared', 'favourited']);
export const boardSortBySchema = z.enum([
  'updatedAt',
  'createdAt',
  'title',
  'memberCount',
]);
export const boardSortOrderSchema = z.enum(['asc', 'desc']);

/** Query contract for `GET /boards` (defaults mirror the API DTO). */
export const listBoardsQuerySchema = z.object({
  tab: boardTabSchema.default('recent'),
  search: z
    .string()
    .trim()
    .max(
      BOARD_SEARCH_MAX_LENGTH,
      `Search must be at most ${BOARD_SEARCH_MAX_LENGTH} characters`,
    )
    .optional(),
  sortBy: boardSortBySchema.default('updatedAt'),
  order: boardSortOrderSchema.default('desc'),
  cursor: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(BOARD_LIST_MAX_LIMIT)
    .default(BOARD_LIST_DEFAULT_LIMIT),
  archived: z.boolean().optional(),
  template: z.boolean().optional(),
  ownedByMe: z.boolean().optional(),
});

export type ListBoardsInput = z.infer<typeof listBoardsQuerySchema>;
