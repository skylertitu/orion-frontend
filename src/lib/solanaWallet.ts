"use client";

import { VersionedTransaction } from "@solana/web3.js";

// ─── Wallet provider types ───────────────────────────────────────────────────

export type WalletProviderName = "phantom" | "solflare";

export type WalletProvider = {
  name: WalletProviderName;
  publicKey?: { toString(): string } | string | null;
  isConnected?: boolean;
  connected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8" | "hex"
  ) => Promise<Uint8Array | { signature: Uint8Array; publicKey?: { toString(): string } }>;
  sign?: (
    message: Uint8Array,
    display?: "utf8" | "hex"
  ) => Promise<Uint8Array | { signature: Uint8Array }>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type PhantomProvider = WalletProvider & { isPhantom?: boolean; isSolflare?: boolean };

export type SolflareProvider = WalletProvider & { isSolflare?: boolean };

// ─── Global window declarations ──────────────────────────────────────────────

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
    solflare?: SolflareProvider;
    SolflareApp?: unknown;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function publicKeyToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";
  const rec = value as { toBase58?: () => string; toString?: () => string; publicKey?: unknown };
  if (typeof rec.toBase58 === "function") {
    const text = rec.toBase58();
    if (text) return text;
  }
  if (typeof rec.toString === "function") {
    const text = rec.toString();
    if (text && text !== "[object Object]") return text;
  }
  if ("publicKey" in rec) return publicKeyToString(rec.publicKey);
  return "";
}

function addressOf(provider: WalletProvider, connectResult?: unknown): string {
  if (typeof connectResult === "boolean") {
    return publicKeyToString(provider.publicKey);
  }
  return publicKeyToString(connectResult) || publicKeyToString(provider.publicKey);
}

function toByteArray(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return Uint8Array.from(value);
  }
  if (typeof value === "object") {
    const rec = value as { signature?: unknown; data?: unknown };
    if (rec.signature != null) return toByteArray(rec.signature);
    if (rec.data != null) return toByteArray(rec.data);
  }
  if (typeof value === "string") {
    try {
      const decoded = base64ToBytes(value);
      if (decoded.length > 0) return decoded;
    } catch {
      return null;
    }
  }
  return null;
}

function bindName<T extends WalletProvider>(provider: T, name: WalletProviderName): T {
  return {
    get name() {
      return name;
    },
    get publicKey() {
      return provider.publicKey;
    },
    get isConnected() {
      return provider.isConnected;
    },
    get connected() {
      return provider.connected;
    },
    get isPhantom() {
      return (provider as PhantomProvider).isPhantom;
    },
    get isSolflare() {
      return (provider as SolflareProvider).isSolflare;
    },
    connect: (opts?: { onlyIfTrusted?: boolean }) => provider.connect(opts),
    disconnect: () => provider.disconnect?.() ?? Promise.resolve(),
    signTransaction: (tx: VersionedTransaction) => provider.signTransaction(tx),
    signMessage:
      typeof provider.signMessage === "function"
        ? (message: Uint8Array, display?: "utf8" | "hex") =>
            provider.signMessage!.call(provider, message, display)
        : undefined,
    sign:
      typeof provider.sign === "function"
        ? (message: Uint8Array, display?: "utf8" | "hex") =>
            provider.sign!.call(provider, message, display)
        : undefined,
    on:
      typeof provider.on === "function"
        ? (event: string, handler: (...args: unknown[]) => void) =>
            provider.on!.call(provider, event, handler)
        : undefined,
    off:
      typeof provider.off === "function"
        ? (event: string, handler: (...args: unknown[]) => void) =>
            provider.off!.call(provider, event, handler)
        : undefined,
  } as T;
}

async function signProviderMessage(provider: WalletProvider, message: string): Promise<string> {
  const sign = provider.signMessage || provider.sign;
  if (!sign) {
    throw new Error(`${provider.name === "solflare" ? "Solflare" : "Phantom"} no soporta signMessage en este navegador`);
  }
  const encoded = new TextEncoder().encode(message);
  let signed: unknown;
  try {
    signed = await sign.call(provider, encoded, "utf8");
  } catch {
    signed = await sign.call(provider, encoded);
  }
  const bytes = toByteArray(signed);
  if (!bytes?.length) {
    throw new Error("La billetera no devolvió una firma válida");
  }
  return bytesToBase64(bytes);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHANTOM
// ═══════════════════════════════════════════════════════════════════════════════

export function isPhantomInstalled(): boolean {
  return Boolean(getPhantom());
}

export function looksLikeSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const fromNamespace = window.phantom?.solana;
  if (fromNamespace && typeof fromNamespace.connect === "function") {
    return bindName(fromNamespace, "phantom");
  }
  const provider = window.solana;
  if (provider?.isPhantom && typeof provider.connect === "function") {
    return bindName(provider, "phantom");
  }
  return null;
}

export function waitForPhantom(timeoutMs = 10000): Promise<PhantomProvider | null> {
  const already = getPhantom();
  if (already) return Promise.resolve(already);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("phantom#initialized", onReady);
      clearInterval(poll);
      clearTimeout(timer);
      resolve(getPhantom());
    };
    const onReady = () => {
      if (getPhantom()) finish();
    };
    window.addEventListener("phantom#initialized", onReady);
    const poll = setInterval(onReady, 200);
    const timer = setTimeout(finish, timeoutMs);
  });
}

export async function reconnectPhantom(): Promise<string> {
  const phantom = getPhantom() || (await waitForPhantom());
  if (!phantom) return "";
  const existing = addressOf(phantom);
  if (existing) return existing;
  try {
    const res = await phantom.connect({ onlyIfTrusted: true });
    return addressOf(phantom, res);
  } catch {
    return addressOf(phantom);
  }
}

export async function connectPhantom(): Promise<string> {
  const phantom = getPhantom() || (await waitForPhantom());
  if (!phantom) {
    throw new Error("Instala Phantom para continuar (https://phantom.app/download)");
  }
  const existing = addressOf(phantom);
  if (existing) return existing;
  try {
    const trusted = await phantom.connect({ onlyIfTrusted: true });
    const silent = addressOf(phantom, trusted);
    if (silent) return silent;
  } catch {
    /* primera vez: hay que pedir el popup */
  }
  const res = await phantom.connect();
  const address = addressOf(phantom, res);
  if (!address) throw new Error("Phantom no devolvió una dirección");
  return address;
}

export async function disconnectPhantom(): Promise<void> {
  const phantom = getPhantom();
  await phantom?.disconnect?.();
}

export async function signJupiterTransaction(transactionBase64: string): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom no está conectado");
  const tx = VersionedTransaction.deserialize(base64ToBytes(transactionBase64));
  const signed = await phantom.signTransaction(tx);
  return bytesToBase64(signed.serialize());
}

export async function signPhantomMessage(message: string): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom no está conectado");
  return signProviderMessage(phantom, message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOLFLARE
// ═══════════════════════════════════════════════════════════════════════════════

export function isSolflareInstalled(): boolean {
  return Boolean(getSolflare());
}

export function getSolflare(): SolflareProvider | null {
  if (typeof window === "undefined") return null;
  const injected = window.solflare;
  if (injected && typeof injected.connect === "function") {
    return bindName(injected, "solflare");
  }
  const solana = window.solana;
  if (solana?.isSolflare && typeof solana.connect === "function") {
    return bindName(solana, "solflare");
  }
  return null;
}

export async function awaitSolflareReady(
  intervalMs = 150,
  timeoutMs = 2000,
): Promise<SolflareProvider | null> {
  const immediate = getSolflare();
  if (immediate) return immediate;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const found = getSolflare();
    if (found) return found;
  }
  return null;
}

export function waitForSolflare(timeoutMs = 10000): Promise<SolflareProvider | null> {
  const already = getSolflare();
  if (already) return Promise.resolve(already);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      resolve(getSolflare());
    };
    const poll = setInterval(() => {
      if (getSolflare()) finish();
    }, 200);
    const timer = setTimeout(finish, timeoutMs);
  });
}

function waitForSolflarePublicKey(
  solflare: SolflareProvider,
  timeoutMs = 15000,
): Promise<string> {
  const already = addressOf(solflare);
  if (already) return Promise.resolve(already);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (addr: string) => {
      if (settled || !addr) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      solflare.off?.("connect", onConnect);
      solflare.off?.("accountChanged", onConnect);
      resolve(addr);
    };

    const onConnect = (...args: unknown[]) => {
      const fromEvent = publicKeyToString(args[0]);
      if (fromEvent) finish(fromEvent);
      const live = addressOf(solflare);
      if (live) finish(live);
    };

    const poll = setInterval(() => {
      const pk = addressOf(solflare);
      if (pk) finish(pk);
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(poll);
      solflare.off?.("connect", onConnect);
      solflare.off?.("accountChanged", onConnect);
      if (!settled) {
        settled = true;
        reject(new Error("Solflare no devolvió una dirección pública"));
      }
    }, timeoutMs);

    solflare.on?.("connect", onConnect);
    solflare.on?.("accountChanged", onConnect);
  });
}

export async function reconnectSolflare(): Promise<string> {
  const solflare = await awaitSolflareReady();
  if (!solflare) return "";
  const existing = addressOf(solflare);
  if (existing) return existing;
  if (!solflare.isConnected && !solflare.connected) return "";
  return waitForSolflarePublicKey(solflare, 3000).catch(() => addressOf(solflare));
}

export async function connectSolflare(): Promise<string> {
  const solflare = (await awaitSolflareReady()) || (await waitForSolflare());
  if (!solflare) {
    throw new Error("Instala Solflare para continuar (https://solflare.com/download)");
  }

  const existing = addressOf(solflare);
  if (existing) return existing;

  try {
    const result = await solflare.connect();
    const address = addressOf(solflare, result);
    if (address) return address;
    return await waitForSolflarePublicKey(solflare, 15000);
  } catch (err) {
    const fallback = addressOf(solflare);
    if (fallback) return fallback;
    throw err instanceof Error ? err : new Error("Solflare rechazó la conexión");
  }
}

export async function disconnectSolflare(): Promise<void> {
  const solflare = getSolflare();
  await solflare?.disconnect?.();
}

export async function signSolflareTransaction(transactionBase64: string): Promise<string> {
  const solflare = getSolflare();
  if (!solflare) throw new Error("Solflare no está conectado");
  const tx = VersionedTransaction.deserialize(base64ToBytes(transactionBase64));
  const signed = await solflare.signTransaction(tx);
  return bytesToBase64(signed.serialize());
}

export async function signSolflareMessage(message: string): Promise<string> {
  const solflare = getSolflare();
  if (!solflare) throw new Error("Solflare no está conectado");
  return signProviderMessage(solflare, message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC WALLET ABSTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

export type ActiveWallet = {
  name: WalletProviderName;
  address: string;
  provider: WalletProvider;
};

let activeWallet: ActiveWallet | null = null;

export function getActiveWallet(): ActiveWallet | null {
  if (!activeWallet) return null;
  const provider =
    activeWallet.name === "solflare" ? getSolflare() : getPhantom();
  if (!provider) {
    activeWallet = null;
    return null;
  }
  const address = addressOf(provider) || activeWallet.address;
  activeWallet = { name: activeWallet.name, address, provider };
  return activeWallet;
}

export function setActiveWallet(wallet: ActiveWallet | null) {
  activeWallet = wallet;
}

export async function connectWallet(name: WalletProviderName): Promise<ActiveWallet> {
  if (name === "solflare") {
    const address = await connectSolflare();
    const provider = getSolflare();
    if (!provider) throw new Error("Solflare no disponible");
    if (!address) throw new Error("Solflare no devolvió una dirección pública");
    const wallet: ActiveWallet = { name: "solflare", address, provider };
    setActiveWallet(wallet);
    return wallet;
  }
  const address = await connectPhantom();
  const provider = getPhantom();
  if (!provider) throw new Error("Phantom no disponible");
  const wallet: ActiveWallet = { name: "phantom", address, provider };
  setActiveWallet(wallet);
  return wallet;
}

export async function disconnectWallet(): Promise<void> {
  if (!activeWallet) return;
  if (activeWallet.name === "solflare") {
    await disconnectSolflare();
  } else {
    await disconnectPhantom();
  }
  setActiveWallet(null);
}

export async function reconnectWallet(): Promise<ActiveWallet | null> {
  const solflare = getSolflare();
  const solflareAddress = solflare ? addressOf(solflare) : "";
  if (solflare && solflareAddress) {
    const wallet: ActiveWallet = { name: "solflare", address: solflareAddress, provider: solflare };
    setActiveWallet(wallet);
    return wallet;
  }
  const phantom = getPhantom();
  const phantomAddress = phantom ? addressOf(phantom) : "";
  if (phantom && phantomAddress) {
    const wallet: ActiveWallet = { name: "phantom", address: phantomAddress, provider: phantom };
    setActiveWallet(wallet);
    return wallet;
  }
  return null;
}

export function detectInstalledWallets(): WalletProviderName[] {
  const wallets: WalletProviderName[] = [];
  if (getPhantom()) wallets.push("phantom");
  if (getSolflare()) wallets.push("solflare");
  return wallets;
}

export async function awaitInstalledWallets(
  intervalMs = 150,
  timeoutMs = 2000,
): Promise<WalletProviderName[]> {
  const immediate = detectInstalledWallets();
  if (immediate.includes("solflare")) return immediate;
  await awaitSolflareReady(intervalMs, timeoutMs);
  return detectInstalledWallets();
}

export async function signWalletTransaction(transactionBase64: string): Promise<string> {
  const wallet = getActiveWallet();
  if (!wallet) throw new Error("No hay billetera conectada");
  return wallet.name === "solflare"
    ? signSolflareTransaction(transactionBase64)
    : signJupiterTransaction(transactionBase64);
}

export async function signWalletMessage(message: string): Promise<string> {
  const wallet = getActiveWallet();
  if (!wallet) throw new Error("No hay billetera conectada");
  return wallet.name === "solflare"
    ? signSolflareMessage(message)
    : signPhantomMessage(message);
}
