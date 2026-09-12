type SupabaseConfig = { url: string; apiKey: string };

export function applyBlockedUserFilter(
  query: URL,
  column: string,
  blockedIds: string[]
): void {
  if (blockedIds.length === 0) {
    return;
  }

  query.searchParams.set(
    'or',
    `(${column}.is.null,${column}.not.in.(${blockedIds.join(',')}))`
  );
}

export async function fetchBlockedUserIds(
  config: SupabaseConfig,
  userId: string
): Promise<string[]> {
  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set('blocker_id', `eq.${userId}`);
  query.searchParams.set('select', 'blocked_id');

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { blocked_id?: string }[];
  return rows
    .map((row) => row.blocked_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function fetchBlockedUserIdsEitherWay(
  config: SupabaseConfig,
  userId: string
): Promise<string[]> {
  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set(
    'or',
    `(blocker_id.eq.${userId},blocked_id.eq.${userId})`
  );
  query.searchParams.set('select', 'blocker_id,blocked_id');

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as {
    blocker_id?: string;
    blocked_id?: string;
  }[];
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.blocker_id === userId && typeof row.blocked_id === 'string') {
      if (row.blocked_id.length > 0) {
        ids.add(row.blocked_id);
      }
    } else if (
      row.blocked_id === userId &&
      typeof row.blocker_id === 'string' &&
      row.blocker_id.length > 0
    ) {
      ids.add(row.blocker_id);
    }
  }
  return [...ids];
}

export async function fetchReportedCommentIds(
  config: SupabaseConfig,
  userId: string
): Promise<string[]> {
  const query = new URL(`${config.url}/rest/v1/comment_reports`);
  query.searchParams.set('reporter_id', `eq.${userId}`);
  query.searchParams.set('select', 'comment_id');

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { comment_id?: string }[];
  return rows
    .map((row) => row.comment_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}
