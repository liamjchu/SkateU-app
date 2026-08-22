import {
  COMMENT_REPORTS_PER_DAY,
  isCommentReportReason,
  validateCommentReportBody,
} from '../../lib/commentReport';
import { sendCommentReportEmail } from '../../lib/commentReportNotify';
import type { CommentReport, CommentReportReason } from '../../types/commentReport';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
  validateSpotId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

type DatabaseCommentReport = {
  id: string;
  comment_id: string;
  reason: string;
  details: string;
  created_at: string;
};

type DatabaseComment = {
  id: string;
  spot_id: string;
  user_id: string | null;
  content: string;
};

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const OWN_COMMENT_ERROR = 'You can delete your own comments instead.';
const RATE_LIMIT_ERROR = 'You can only submit a few comment reports each day.';

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

export function mapCommentReport(row: DatabaseCommentReport): CommentReport {
  const reason: CommentReportReason = isCommentReportReason(row.reason)
    ? row.reason
    : 'other';

  return {
    id: row.id,
    commentId: row.comment_id,
    reason,
    details: row.details ?? '',
    createdAt: row.created_at ?? '',
  };
}

function isUniqueViolation(status: number, body: string): boolean {
  return status === 409 && (body.includes('23505') || /duplicate key/i.test(body));
}

async function fetchComment(
  config: SupabaseConfig,
  commentId: string
): Promise<DatabaseComment | null> {
  const query = new URL(`${config.url}/rest/v1/spot_comments`);
  query.searchParams.set('id', `eq.${commentId}`);
  query.searchParams.set('select', 'id,spot_id,user_id,content');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as DatabaseComment[];
  return rows[0] ?? null;
}

async function fetchOwnReport(
  config: SupabaseConfig,
  commentId: string,
  reporterId: string
): Promise<CommentReport | null> {
  const query = new URL(`${config.url}/rest/v1/comment_reports`);
  query.searchParams.set('comment_id', `eq.${commentId}`);
  query.searchParams.set('reporter_id', `eq.${reporterId}`);
  query.searchParams.set('select', 'id,comment_id,reason,details,created_at');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as DatabaseCommentReport[];
  return rows[0] ? mapCommentReport(rows[0]) : null;
}

async function countRecentReports(
  config: SupabaseConfig,
  reporterId: string
): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const query = new URL(`${config.url}/rest/v1/comment_reports`);
  query.searchParams.set('reporter_id', `eq.${reporterId}`);
  query.searchParams.set('created_at', `gte.${since}`);
  query.searchParams.set('select', 'id');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { id: string }[];
  return rows.length;
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Comment reports are not configured.' },
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

  const validation = validateCommentReportBody(body, validateSpotId);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const { commentId, reason, details } = validation.value;

  try {
    const comment = await fetchComment(config, commentId);
    if (!comment) {
      return Response.json({ error: 'That comment no longer exists.' }, { status: 404 });
    }
    if (comment.user_id === user.userId) {
      return Response.json({ error: OWN_COMMENT_ERROR }, { status: 400 });
    }

    const existing = await fetchOwnReport(config, commentId, user.userId);
    if (existing) {
      return Response.json({ report: existing, alreadyReported: true });
    }

    const recentCount = await countRecentReports(config, user.userId);
    if (recentCount >= COMMENT_REPORTS_PER_DAY) {
      return Response.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const insert = await fetch(`${config.url}/rest/v1/comment_reports`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        comment_id: commentId,
        reporter_id: user.userId,
        reason,
        details,
      }),
    });

    if (!insert.ok) {
      const message = await insert.text();
      if (isUniqueViolation(insert.status, message)) {
        const duplicate = await fetchOwnReport(config, commentId, user.userId);
        return Response.json({
          report: duplicate,
          alreadyReported: true,
        });
      }
      throw new Error(message);
    }

    const rows = (await insert.json()) as DatabaseCommentReport[];
    const report = rows[0] ? mapCommentReport(rows[0]) : null;
    if (!report) {
      throw new Error('Comment report insert returned no row.');
    }

    try {
      await sendCommentReportEmail({
        reportId: report.id,
        commentId: comment.id,
        spotId: comment.spot_id,
        reason: report.reason,
        details: report.details,
        commentContent: comment.content,
        reporterId: user.userId,
      });
    } catch (error) {
      console.error('Sending comment report email failed:', error);
    }

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Reporting comment failed:', error);
    return Response.json(
      { error: 'Couldn’t send that report right now.' },
      { status: 500 }
    );
  }
}
