const ALLOWED_HOSTS = new Set([
  "solscan.io",
  "explorer.solana.com",
  "faucet.solana.com",
]);

function hostAllowed(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  for (const allowed of ALLOWED_HOSTS) {
    if (host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

/** Returns the URL only if it is https and on an allowlisted Solana explorer/faucet. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!hostAllowed(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
