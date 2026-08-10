import "server-only";

type RpcDefinition = {
  subscribe_email: {
    args: { p_email: string };
    returns: null;
  };
  confirm_subscription: {
    args: { p_token: string };
    returns: boolean;
  };
};

type RpcResult<T> = { data: T | null; error: Error | null };

type SupabaseAdmin = {
  rpc<Name extends keyof RpcDefinition>(
    functionName: Name,
    args: RpcDefinition[Name]["args"]
  ): Promise<RpcResult<RpcDefinition[Name]["returns"]>>;
};

const requestTimeoutMs = 10_000;
let supabaseAdmin: SupabaseAdmin | null = null;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function callRpc<Name extends keyof RpcDefinition>(
  functionName: Name,
  args: RpcDefinition[Name]["args"]
): Promise<RpcResult<RpcDefinition[Name]["returns"]>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const supabaseUrl = requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
    const response = await fetch(
      new URL(`/rest/v1/rpc/${functionName}`, supabaseUrl),
      {
        method: "POST",
        headers: { apikey: serviceRoleKey, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return { data: null, error: new Error(`Supabase RPC failed with status ${response.status}`) };
    }

    const data: unknown = await response.json().catch(() => null);
    return { data: data as RpcDefinition[Name]["returns"] | null, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Supabase RPC request failed"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getSupabaseAdmin(): SupabaseAdmin {
  if (!supabaseAdmin) {
    supabaseAdmin = { rpc: callRpc };
  }
  return supabaseAdmin;
}
