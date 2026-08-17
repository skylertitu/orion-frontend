"use client";

import { VersionedTransaction } from "@solana/web3.js";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
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

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const provider = window.solana;
  if (provider?.isPhantom) return provider;
  return null;
}

export async function connectPhantom(): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) {
    throw new Error("Instala Phantom para firmar el swap (https://phantom.app)");
  }
  const res = await phantom.connect();
  const address = res.publicKey?.toString() || phantom.publicKey?.toString() || "";
  if (!address) throw new Error("Phantom no devolvió una dirección");
  return address;
}

export async function signJupiterTransaction(transactionBase64: string): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom no está conectado");
  const tx = VersionedTransaction.deserialize(base64ToBytes(transactionBase64));
  const signed = await phantom.signTransaction(tx);
  return bytesToBase64(signed.serialize());
}
