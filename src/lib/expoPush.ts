const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_PATTERN =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export type ExpoPushPlatform = 'ios' | 'android';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
  channelId?: string;
};

export type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export function isExpoPushToken(value: string): boolean {
  return EXPO_PUSH_TOKEN_PATTERN.test(value.trim());
}

export function parseExpoPushPlatform(value: unknown): ExpoPushPlatform | null {
  return value === 'ios' || value === 'android' ? value : null;
}

export function buildExpoPushMessage(input: {
  token: string;
  body: string;
  data: Record<string, string>;
}): ExpoPushMessage {
  return {
    to: input.token,
    title: 'SkateU',
    body: input.body,
    data: input.data,
    sound: 'default',
    channelId: 'default',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseExpoPushTickets(value: unknown): ExpoPushTicket[] {
  if (!isRecord(value)) {
    return [];
  }
  const data = value.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item): ExpoPushTicket => {
    if (!isRecord(item)) {
      return { status: 'error', message: 'Invalid ticket' };
    }
    if (item.status === 'ok') {
      return {
        status: 'ok',
        id: typeof item.id === 'string' ? item.id : undefined,
      };
    }
    const details = isRecord(item.details) ? item.details : undefined;
    return {
      status: 'error',
      message: typeof item.message === 'string' ? item.message : undefined,
      details: {
        error: typeof details?.error === 'string' ? details.error : undefined,
      },
    };
  });
}

export function tokensToDrop(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[]
): string[] {
  const tokens: string[] = [];
  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    const message = messages[index];
    if (
      ticket?.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered' &&
      message
    ) {
      tokens.push(message.to);
    }
  }
  return tokens;
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  fetchImpl: typeof fetch = fetch
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) {
    return [];
  }

  const tickets: ExpoPushTicket[] = [];
  for (let start = 0; start < messages.length; start += 100) {
    const batch = messages.slice(start, start + 100);
    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error('Expo push send failed.');
    }
    tickets.push(...parseExpoPushTickets(payload));
  }
  return tickets;
}
