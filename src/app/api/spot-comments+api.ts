import {
    COMMENT_PAGE_SIZE,
    getCommentContentError,
    prefilterComment,
} from '../../lib/commentForm';
import { parseOffset } from '../../lib/homeFeed';
import {
    moderateComment,
    softenCommentModerationReason,
    type CommentModerationVerdict,
} from '../../lib/commentModeration';
import { displayableAvatarUrl } from '../../lib/avatarUrl';
import type { SpotComment } from '../../types/comment';
import {
    authUserMessage,
    getSupabaseConfig,
    isHiddenSpotStatus,
    resolveUserId,
    validateSpotId,
} from './spots+api';
import {
    fetchBlockedUserIds,
    fetchReportedCommentIds,
} from './blockedUsers';

type SupabaseConfig = { url: string; apiKey: string };

type DatabaseComment = {
  id: string;
  spot_id: string;
  user_id: string | null;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  creator: { username: string | null; avatar_url?: string | null } | null;
};

type SpotCountRow = { id: string; comments_count?: number; status?: string };

export const COMMENT_SELECT_COLUMNS =
  'id,spot_id,user_id,parent_comment_id,content,created_at,creator:profiles(username,avatar_url)';

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function authError(reason: 'invalid' | 'expired' | 'timeout'): Response {
  const status = reason === 'timeout' ? 503 : 401;
  return Response.json({ error: authUserMessage(reason) }, { status });
}

async function requireUser(
  request: Request,
  config: SupabaseConfig
): Promise<{ userId: string } | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json({ error: authUserMessage('missing') }, { status: 401 });
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? { userId: auth.userId } : authError(auth.reason);
}

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

export function mapComment(
  row: DatabaseComment,
  replies: SpotComment[] = []
): SpotComment {
  return {
    id: row.id,
    spotId: row.spot_id,
    userId: row.user_id,
    parentCommentId: row.parent_comment_id,
    content: row.content,
    creatorUsername: row.creator?.username ?? null,
    creatorAvatarUrl: displayableAvatarUrl(row.creator?.avatar_url ?? null),
    createdAt: row.created_at ?? '',
    replies,
  };
}

export type ValidatedCommentBody = {
  spotId: string;
  content: string;
  parentCommentId: string | null;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function validateCommentBody(body: unknown): ValidationResult<ValidatedCommentBody> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The request body is malformed.' };
  }

  const record = body as {
    spotId?: unknown;
    content?: unknown;
    parentCommentId?: unknown;
  };

  const spotId = typeof record.spotId === 'string' ? record.spotId : '';
  const spotValidation = validateSpotId(spotId);
  if (!spotValidation.ok) {
    return { ok: false, message: 'The spot id is invalid.' };
  }

  const content = typeof record.content === 'string' ? record.content : '';
  const contentError = getCommentContentError(content);
  if (contentError) {
    return { ok: false, message: contentError };
  }

  if (
    record.parentCommentId !== undefined &&
    record.parentCommentId !== null &&
    typeof record.parentCommentId !== 'string'
  ) {
    return { ok: false, message: 'The parent comment id is invalid.' };
  }

  let parentCommentId: string | null = null;
  if (typeof record.parentCommentId === 'string' && record.parentCommentId.length > 0) {
    const parentValidation = validateSpotId(record.parentCommentId);
    if (!parentValidation.ok) {
      return { ok: false, message: 'The parent comment id is invalid.' };
    }
    parentCommentId = parentValidation.value;
  }

  return {
    ok: true,
    value: {
      spotId: spotValidation.value,
      content: content.trim(),
      parentCommentId,
    },
  };
}

function moderationRejectionResponse(
  moderation: CommentModerationVerdict
): Response {
  const flag =
    moderation.flag === 'INAPPROPRIATE' || moderation.flag === 'IRRELEVANT'
      ? moderation.flag
      : 'IRRELEVANT';
  return Response.json(
    {
      approved: false,
      flag,
      reason: softenCommentModerationReason(flag),
    },
    { status: 422 }
  );
}

function prefilterRejectionResponse(reason: string): Response {
  return Response.json({ approved: false, reason }, { status: 422 });
}

async function readSpotCommentCount(
  config: SupabaseConfig,
  spotId: string
): Promise<SpotCountRow | null> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('select', 'id,comments_count,status');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) throw new Error(await response.text());

  const rows = (await response.json()) as SpotCountRow[];
  return rows[0] ?? null;
}

async function fetchCommentsByQuery(
  config: SupabaseConfig,
  params: URLSearchParams
): Promise<DatabaseComment[]> {
  const query = new URL(`${config.url}/rest/v1/spot_comments`);
  params.forEach((value, key) => {
    query.searchParams.set(key, value);
  });

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) throw new Error(await response.text());

  return (await response.json()) as DatabaseComment[];
}

async function fetchCommentById(
  config: SupabaseConfig,
  commentId: string
): Promise<DatabaseComment | null> {
  const params = new URLSearchParams();
  params.set('id', `eq.${commentId}`);
  params.set('select', COMMENT_SELECT_COLUMNS);
  const rows = await fetchCommentsByQuery(config, params);
  return rows[0] ?? null;
}

const MAX_VISIBLE_FILL_PAGES = 50;

async function collectVisibleTopLevelComments(
  config: SupabaseConfig,
  spotId: string,
  offset: number,
  isVisible: (row: DatabaseComment) => boolean
): Promise<{
  rows: DatabaseComment[];
  nextOffset: number;
  hasMore: boolean;
}> {
  const visible: DatabaseComment[] = [];
  let rawOffset = offset;
  let hasMore = false;

  for (
    let page = 0;
    page < MAX_VISIBLE_FILL_PAGES && visible.length < COMMENT_PAGE_SIZE;
    page += 1
  ) {
    const params = new URLSearchParams();
    params.set('spot_id', `eq.${spotId}`);
    params.set('parent_comment_id', 'is.null');
    params.set('select', COMMENT_SELECT_COLUMNS);
    params.set('order', 'created_at.desc,id.desc');
    params.set('offset', String(rawOffset));
    params.set('limit', String(COMMENT_PAGE_SIZE));

    const rawRows = await fetchCommentsByQuery(config, params);
    if (rawRows.length === 0) {
      hasMore = false;
      break;
    }

    for (let index = 0; index < rawRows.length; index += 1) {
      rawOffset += 1;
      if (!isVisible(rawRows[index])) {
        continue;
      }

      visible.push(rawRows[index]);
      if (visible.length === COMMENT_PAGE_SIZE) {
        hasMore =
          index < rawRows.length - 1 || rawRows.length === COMMENT_PAGE_SIZE;
        return { rows: visible, nextOffset: rawOffset, hasMore };
      }
    }

    if (rawRows.length < COMMENT_PAGE_SIZE) {
      hasMore = false;
      break;
    }

    hasMore = true;
  }

  return { rows: visible, nextOffset: rawOffset, hasMore };
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spot comments database is not configured.' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const spotValidation = validateSpotId(url.searchParams.get('spotId'));
  if (!spotValidation.ok) {
    return Response.json({ error: spotValidation.message }, { status: 400 });
  }

  const spotId = spotValidation.value;
  const offset = parseOffset(url.searchParams.get('offset'));

  try {
    const spot = await readSpotCommentCount(config, spotId);
    if (!spot || isHiddenSpotStatus(spot.status)) {
      return Response.json({ error: 'That spot no longer exists.' }, { status: 404 });
    }

    const hiddenUsers = new Set<string>();
    const hiddenComments = new Set<string>();
    const accessToken = readBearerToken(request);
    if (accessToken) {
      const auth = await resolveUserId(config, accessToken);
      if (auth.ok) {
        try {
          const [blockedIds, reportedIds] = await Promise.all([
            fetchBlockedUserIds(config, auth.userId),
            fetchReportedCommentIds(config, auth.userId),
          ]);
          blockedIds.forEach((id) => hiddenUsers.add(id));
          reportedIds.forEach((id) => hiddenComments.add(id));
        } catch (error) {
          console.error('Loading comment safety filters failed:', error);
        }
      }
    }

    const isVisible = (row: DatabaseComment): boolean => {
      if (row.user_id && hiddenUsers.has(row.user_id)) {
        return false;
      }
      return !hiddenComments.has(row.id);
    };

    const {
      rows: topLevelRows,
      nextOffset,
      hasMore,
    } = await collectVisibleTopLevelComments(config, spotId, offset, isVisible);
    const parentIds = topLevelRows.map((row) => row.id);

    let replyRows: DatabaseComment[] = [];
    if (parentIds.length > 0) {
      const replyParams = new URLSearchParams();
      replyParams.set('parent_comment_id', `in.(${parentIds.join(',')})`);
      replyParams.set('select', COMMENT_SELECT_COLUMNS);
      replyParams.set('order', 'created_at.asc,id.asc');
      replyRows = (await fetchCommentsByQuery(config, replyParams)).filter(isVisible);
    }

    const repliesByParent = new Map<string, SpotComment[]>();
    for (const row of replyRows) {
      if (!row.parent_comment_id) continue;
      const mapped = mapComment(row);
      const existing = repliesByParent.get(row.parent_comment_id) ?? [];
      existing.push(mapped);
      repliesByParent.set(row.parent_comment_id, existing);
    }

    return Response.json({
      comments: topLevelRows.map((row) =>
        mapComment(row, repliesByParent.get(row.id) ?? [])
      ),
      commentCount: spot.comments_count ?? 0,
      nextOffset,
      hasMore,
    });
  } catch (error) {
    console.error('Loading spot comments failed:', error);
    return Response.json(
      { error: 'Unable to load comments right now.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spot comments database is not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const validation = validateCommentBody(body);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const { spotId, content, parentCommentId } = validation.value;

  const prefilter = prefilterComment(content);
  if (!prefilter.ok) {
    return prefilterRejectionResponse(prefilter.reason);
  }

  try {
    const spot = await readSpotCommentCount(config, spotId);
    if (!spot || isHiddenSpotStatus(spot.status)) {
      return Response.json({ error: 'That spot no longer exists.' }, { status: 404 });
    }

    if (parentCommentId) {
      const parent = await fetchCommentById(config, parentCommentId);
      if (!parent) {
        return Response.json(
          { error: 'That comment is no longer here.' },
          { status: 404 }
        );
      }
      if (parent.spot_id !== spotId) {
        return Response.json(
          { error: 'Replies must belong to the same spot.' },
          { status: 400 }
        );
      }
      if (parent.parent_comment_id) {
        return Response.json(
          { error: 'Replies can only be one level deep.' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Checking comment parent failed:', error);
    return Response.json(
      { error: 'Unable to post this comment right now.' },
      { status: 500 }
    );
  }

  try {
    const moderation = await moderateComment(content);
    if (!moderation.approved) {
      return moderationRejectionResponse(moderation);
    }
  } catch (error) {
    console.error('Comment moderation failed before create:', error);
    return Response.json(
      { error: 'Content check is paused. Try again in a sec.' },
      { status: 503 }
    );
  }

  try {
    const insertUrl = new URL(`${config.url}/rest/v1/spot_comments`);
    insertUrl.searchParams.set('select', COMMENT_SELECT_COLUMNS);

    const response = await fetch(insertUrl.toString(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        spot_id: spotId,
        user_id: user.userId,
        parent_comment_id: parentCommentId,
        content,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const rows = (await response.json()) as DatabaseComment[];
    const created = rows[0];
    if (!created) {
      throw new Error('Insert returned no representation.');
    }

    const countRow = await readSpotCommentCount(config, spotId);
    return Response.json(
      {
        comment: mapComment(created),
        commentCount: countRow?.comments_count ?? 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Creating comment failed:', error);
    return Response.json(
      { error: 'Couldn’t post this comment right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spot comments database is not configured.' },
      { status: 500 }
    );
  }

  const idValidation = validateSpotId(new URL(request.url).searchParams.get('id'));
  if (!idValidation.ok) {
    return Response.json({ error: idValidation.message }, { status: 400 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    const existing = await fetchCommentById(config, idValidation.value);
    if (!existing) {
      return Response.json(
        { error: 'That comment is no longer here.' },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.userId) {
      return Response.json(
        { error: 'You can only delete your own comments.' },
        { status: 403 }
      );
    }

    const query = new URL(`${config.url}/rest/v1/spot_comments`);
    query.searchParams.set('id', `eq.${idValidation.value}`);

    const response = await fetch(query.toString(), {
      method: 'DELETE',
      headers: supabaseHeaders(config),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const countRow = await readSpotCommentCount(config, existing.spot_id);
    return Response.json({
      commentCount: countRow?.comments_count ?? 0,
      deletedId: existing.id,
      spotId: existing.spot_id,
      parentCommentId: existing.parent_comment_id,
    });
  } catch (error) {
    console.error('Deleting comment failed:', error);
    return Response.json(
      { error: 'Couldn’t delete this comment right now.' },
      { status: 500 }
    );
  }
}
