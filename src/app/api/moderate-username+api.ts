// Server-side username moderation. The OpenAI key lives only here (never
// EXPO_PUBLIC_*), so it is never shipped in the client bundle.
//
// We use a small chat model as a classifier rather than the /moderations
// endpoint: moderation categories cover hate/sexual/violence/self-harm but not
// plain profanity or crude slang, and usernames are concatenated + often use
// leetspeak, which a rubric-driven classifier handles far better.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const USERNAME_MAX = 20;

const SYSTEM_PROMPT = `You are a strict username moderation filter for SkateU, a school skate-spot app used by all ages. Decide if a username is safe to display publicly, like Instagram or Roblox would allow.

Reject the username if it contains, references, or clearly hints at any of the following, INCLUDING obfuscated, misspelled, leetspeak (e.g. 4=a, 3=e, 1=i, 0=o, $=s), or concatenated forms without spaces:
- Profanity, vulgar language, or crude slang
- Sexual content, body parts, or sexual acts
- Slurs or hate toward any group (race, religion, gender, sexuality, disability, etc.)
- Harassment, threats, or violence
- Drugs, alcohol abuse, or illegal activity
- Bodily functions or gross-out references
- Impersonation of staff/admin/official accounts (e.g. "admin", "moderator", "official")
- Sensitive personal information, including passwords, passcodes, PINs, login credentials, API/private keys, Social Security numbers, credit/debit card numbers or security codes, bank/routing numbers, government IDs, passports, driver's licenses, student IDs, medical records, private home addresses, personal phone numbers, personal email addresses, or private documents

Allow ordinary names, nicknames, school/skate terms, hobbies, numbers, and neutral words only when they do not resemble sensitive personal information. Never repeat a detected secret or identifier in the reason. When uncertain whether something is a disguised bad word or sensitive personal information, err on the side of rejecting.

Respond ONLY with compact JSON: {"appropriate": boolean, "reason": string}. "reason" is a short, friendly, user-facing explanation (without profanity or sensitive values) when appropriate is false, otherwise an empty string.`;

type ModerationVerdict = {
  appropriate: boolean;
  reason: string;
};

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function containsSensitiveNumericIdentifier(value: string): boolean {
  const compact = value.replace(/[\s_-]/g, '');
  if (!/^\d+$/.test(compact)) {
    return false;
  }

  // Catch common SSN-like and payment-card-like values before spending an AI
  // request. Usernames are short, so these lengths are safe privacy guards.
  return compact.length === 9 || (compact.length >= 13 && compact.length <= 19);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'Username moderation is not configured.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const username =
    typeof (body as { username?: unknown })?.username === 'string'
      ? (body as { username: string }).username.trim()
      : '';

  if (!username || username.length > USERNAME_MAX) {
    return badRequest('A valid username is required.');
  }

  if (containsSensitiveNumericIdentifier(username)) {
    return Response.json({
      allowed: false,
      reason: 'Usernames cannot contain sensitive personal information.',
    });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Username: ${username}` },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('OpenAI moderation request failed:', detail);
      // Fail closed: tell the client to retry rather than silently allowing.
      return Response.json(
        { error: 'Could not verify the username right now. Try again.' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return Response.json(
        { error: 'Could not verify the username right now. Try again.' },
        { status: 502 }
      );
    }

    const verdict = JSON.parse(content) as ModerationVerdict;

    return Response.json({
      allowed: verdict.appropriate === true,
      reason:
        typeof verdict.reason === 'string' && verdict.reason.length > 0
          ? verdict.reason
          : "That username isn't allowed. Please pick another.",
    });
  } catch (error) {
    console.error('Username moderation failed:', error);
    return Response.json(
      { error: 'Could not verify the username right now. Try again.' },
      { status: 502 }
    );
  }
}
