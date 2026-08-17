"use client";

import ToastHost from "@/components/ToastHost";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}
