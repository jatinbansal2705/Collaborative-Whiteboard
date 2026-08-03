/**
 * REST endpoint map mirroring the backend controllers (docs/PRD.md Part 6).
 * All paths are relative to the API base URL (`NEXT_PUBLIC_API_URL`).
 */
export const API_ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    verifyEmail: '/auth/verify-email',
    resendVerification: '/auth/resend-verification',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    sessions: '/auth/sessions',
    session: (id: string) => `/auth/sessions/${id}`,
    google: '/auth/google',
    googleExchange: '/auth/google/exchange',
  },
  boards: {
    list: '/boards',
    create: '/boards',
    detail: (id: string) => `/boards/${id}`,
    update: (id: string) => `/boards/${id}`,
    remove: (id: string) => `/boards/${id}`,
    duplicate: (id: string) => `/boards/${id}/duplicate`,
    archive: (id: string) => `/boards/${id}/archive`,
    restore: (id: string) => `/boards/${id}/restore`,
    favourite: (id: string) => `/boards/${id}/favourite`,
    unfavourite: (id: string) => `/boards/${id}/favourite`,
    members: (id: string) => `/boards/${id}/members`,
    memberRole: (boardId: string, userId: string) =>
      `/boards/${boardId}/members/${userId}/role`,
    leave: (id: string) => `/boards/${id}/members/me`,
    removeMember: (boardId: string, userId: string) =>
      `/boards/${boardId}/members/${userId}`,
    templates: '/boards/templates',
    createTemplate: '/boards/templates',
    versions: (id: string) => `/boards/${id}/versions`,
    version: (id: string, versionNo: string) =>
      `/boards/${id}/versions/${versionNo}/restore`,
    data: (id: string) => `/boards/${id}/data`,
  },
  comments: {
    list: (boardId: string) => `/boards/${boardId}/comments`,
    create: (boardId: string) => `/boards/${boardId}/comments`,
    reply: (commentId: string) => `/comments/${commentId}/replies`,
    resolve: (commentId: string) => `/comments/${commentId}/resolve`,
  },
  chat: {
    messages: (boardId: string) => `/boards/${boardId}/messages`,
  },
  notifications: {
    list: '/notifications',
    read: (id: string) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all',
  },
  templates: {
    list: '/templates',
  },
  uploads: {
    create: '/uploads',
  },
  health: '/health',
} as const;
