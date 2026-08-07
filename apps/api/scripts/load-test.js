import http from 'k6/http';
import { check, group, sleep } from 'k6';

/**
 * REST load test for the Collaborative Whiteboard API.
 *
 * Each virtual user registers a unique account, creates one board, and then
 * mixes read and write traffic against it: board list/detail/members, chat
 * list + post, and comment threads. Budgets (see docs/PERFORMANCE.md):
 *   - http_req_duration p95 < 150ms for reads, < 300ms for writes
 *   - failure rate < 1%
 *
 * Run with:
 *   k6 run scripts/load-test.js
 *   k6 run -e BASE_URL=http://localhost:3000/api/v1 scripts/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const VUS = __ENV.VUS || 20;
const DURATION = __ENV.DURATION || '1m';
// The auth routes are per-IP rate limited (AUTH_RATE_LIMIT, default 5/min),
// so registration happens once in setup() for a bounded pool of users that
// the virtual users then share. Keep this <= AUTH_RATE_LIMIT.
const POOL = Math.min(Number(__ENV.POOL || 5), 5);

const params = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const POST_PAYLOAD = {
  body: `Load test message ${Date.now()}`,
};

const THREAD_PAYLOAD = {
  x: 120,
  y: 340,
  body: 'Load test comment',
};

export function setup() {
  const tokens = [];
  for (let i = 0; i < POOL; i += 1) {
    const email = `loadtest-pool-${i}-${Date.now()}@example.com`;
    const res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({
        email,
        password: 'LoadTestPassw0rd!',
        confirmPassword: 'LoadTestPassw0rd!',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    const data = res.json()?.data;
    check(res, {
      [`setup register ${i}`]: () =>
        res.status === 201 && typeof data?.accessToken === 'string',
    });
    tokens.push(data?.accessToken);
  }
  return { tokens };
}

export const options = {
  scenarios: {
    mixed_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    'http_req_duration{type:read}': ['p(95)<150'],
    'http_req_duration{type:write}': ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const state = {};

export default function (data) {
  try {
    runIteration(data);
  } catch (error) {
    console.error(`VU ${__VU} iteration error: ${error}`);
  } finally {
    sleep(1);
  }
}

function runIteration(data) {
  const vu = __VU;
  const token = data.tokens[vu % data.tokens.length];

  if (!state[vu]) {
    state[vu] = { boardId: null };
  }
  let { boardId } = state[vu];

  if (!boardId) {
    const created = http.post(
      `${BASE_URL}/boards`,
      JSON.stringify({ title: `Load test board ${vu}` }),
      params(token),
    );
    const board = created.json()?.data;
    check(created, {
      'board created': () => created.status === 201 && !!board?.id,
    });
    boardId = board?.id;
    state[vu].boardId = boardId;
  }
  if (!boardId) {
    return;
  }

  group('reads', () => {
    const list = http.get(`${BASE_URL}/boards`, {
      ...params(token),
      tags: { type: 'read' },
    });
    check(list, { 'boards list 200': (r) => r.status === 200 });

    const detail = http.get(`${BASE_URL}/boards/${boardId}`, {
      ...params(token),
      tags: { type: 'read' },
    });
    check(detail, { 'board detail 200': (r) => r.status === 200 });

    const members = http.get(
      `${BASE_URL}/boards/${boardId}/members`,
      { ...params(token), tags: { type: 'read' } },
    );
    check(members, { 'members 200': (r) => r.status === 200 });

    const messages = http.get(
      `${BASE_URL}/boards/${boardId}/messages?limit=20`,
      { ...params(token), tags: { type: 'read' } },
    );
    check(messages, { 'chat list 200': (r) => r.status === 200 });

    const threads = http.get(
      `${BASE_URL}/boards/${boardId}/comments`,
      { ...params(token), tags: { type: 'read' } },
    );
    check(threads, { 'comment threads 200': (r) => r.status === 200 });
  });

  group('writes', () => {
    const message = http.post(
      `${BASE_URL}/boards/${boardId}/messages`,
      JSON.stringify(POST_PAYLOAD),
      { ...params(token), tags: { type: 'write' } },
    );
    check(message, { 'chat post 201': (r) => r.status === 201 });

    const thread = http.post(
      `${BASE_URL}/boards/${boardId}/comments`,
      JSON.stringify(THREAD_PAYLOAD),
      { ...params(token), tags: { type: 'write' } },
    );
    check(thread, { 'comment thread 201': (r) => r.status === 201 });
  });
}
