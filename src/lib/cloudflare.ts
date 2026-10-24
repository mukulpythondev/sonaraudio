export const DEFAULT_CLOUDFLARE_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function cloudflareConfigured() {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID?.trim());
}

export function cloudflareConfig() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const model = process.env.CLOUDFLARE_MODEL?.trim() || DEFAULT_CLOUDFLARE_MODEL;
  if (!apiToken || !accountId) {
    return { ready: false as const, message: "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID and restart to use Workers AI." };
  }
  if (!/^[a-f0-9]{32}$/iu.test(accountId) || !/^@(?:cf|hf)\/[a-z0-9._-]+\/[a-z0-9._-]+$/u.test(model)) {
    return { ready: false as const, message: "Cloudflare needs a valid account ID and model ID." };
  }
  return { ready: true as const, apiToken, accountId, model };
}
