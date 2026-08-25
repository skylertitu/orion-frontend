"use client";

import { VersionedTransaction } from "@solana/web3.js";

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8" | "hex"
  ) => Promise<{ signature: Uint8Array; publicKey?: { toString(): string } }>;
  on?: (event: "connect" | "disconnect" | "accountChanged", handler: (pubkey?: { toString(): string } | null) => void) => void;
  off?: (event: "connect" | "disconnect" | "accountChanged", handler: (pubkey?: { toString(): string } | null) => void) => void;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
    solflare?: PhantomProvider & { isSolflare?: boolean };
  }
}

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

export function isPhantomInstalled(): boolean {
  return Boolean(getPhantom());
}

export function isSolflareInstalled(): boolean {
  return Boolean(getSolflare());
}

export function looksLikeSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

export function getSolflare(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const provider = window.solflare;
  if (provider && typeof provider.connect === "function") return provider;
  return null;
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const fromNamespace = window.phantom?.solana;
  if (fromNamespace && typeof fromNamespace.connect === "function") return fromNamespace;
  const provider = window.solana;
  if (provider?.isPhantom && typeof provider.connect === "function") return provider;
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

function addressOf(phantom: PhantomProvider, fallback?: { toString(): string }): string {
  return fallback?.toString() || phantom.publicKey?.toString() || "";
}

function signatureBytes(signed: { signature: Uint8Array } | Uint8Array): Uint8Array {
  return signed instanceof Uint8Array ? signed : signed.signature;
}

export function waitForSolflare(timeoutMs = 10000): Promise<PhantomProvider | null> {
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

export async function reconnectPhantom(): Promise<string> {
  const phantom = getPhantom() || (await waitForPhantom());
  if (!phantom) return "";
  if (phantom.publicKey) return phantom.publicKey.toString();
  try {
    const res = await phantom.connect({ onlyIfTrusted: true });
    return addressOf(phantom, res.publicKey);
  } catch {
    return addressOf(phantom);
  }
}

export async function connectSolflare(): Promise<string> {
  const wallet = getSolflare() || (await waitForSolflare());
  if (!wallet) {
    throw new Error("Instala Solflare para continuar (https://solflare.com)");
  }
  if (wallet.publicKey) return wallet.publicKey.toString();
  const res = await wallet.connect();
  const address = addressOf(wallet, res.publicKey);
  if (!address) throw new Error("Solflare no devolvió una dirección");
  return address;
}

export async function signSolflareMessage(message: string): Promise<string> {
  const wallet = getSolflare();
  if (!wallet?.signMessage) {
    throw new Error("Solflare no soporta signMessage en este navegador");
  }
  const encoded = new TextEncoder().encode(message);
  const signed = await wallet.signMessage(encoded, "utf8");
  return bytesToBase64(signatureBytes(signed));
}

export async function connectPhantom(): Promise<string> {
  const phantom = getPhantom() || (await waitForPhantom());
  if (!phantom) {
    throw new Error("Instala Phantom para continuar (https://phantom.app/download)");
  }
  if (phantom.publicKey) return phantom.publicKey.toString();
  try {
    const trusted = await phantom.connect({ onlyIfTrusted: true });
    const silent = addressOf(phantom, trusted.publicKey);
    if (silent) return silent;
  } catch {
    /* primera vez: hay que pedir el popup */
  }
  const res = await phantom.connect();
  const address = addressOf(phantom, res.publicKey);
  if (!address) throw new Error("Phantom no devolvió una dirección");
  return address;
}

export async function disconnectPhantom(): Promise<void> {
  const phantom = getPhantom();
  await phantom?.disconnect?.();
}

export async function disconnectSolflare(): Promise<void> {
  const wallet = getSolflare();
  await wallet?.disconnect?.();
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
  if (!phantom?.signMessage) {
    throw new Error("Phantom no soporta signMessage en este navegador");
  }
  const encoded = new TextEncoder().encode(message);
  const signed = await phantom.signMessage(encoded, "utf8");
  return bytesToBase64(signatureBytes(signed));
}
