'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface WsKlineData {
  symbol: string;
  interval: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal?: boolean;
}

export interface WsMessage {
  type: string;
  data?: any;
  message?: string;
}

function getMarketWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = process.env.NEXT_PUBLIC_BACKEND_PORT || '3008';
  return `${protocol}//${window.location.hostname}:${port}/ws/market`;
}

interface UseMarketWsOptions {
  symbol: string;
  interval?: string;
  onKline?: (kline: WsKlineData) => void;
  onKlineClosed?: (kline: WsKlineData) => void;
  onTrade?: (trade: any) => void;
}

export function useMarketWs({ symbol, interval = '1m', onKline, onKlineClosed, onTrade }: UseMarketWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [klines, setKlines] = useState<WsKlineData[]>([]);
  const callbacksRef = useRef({ onKline, onKlineClosed, onTrade });
  callbacksRef.current = { onKline, onKlineClosed, onTrade };

  useEffect(() => {
    if (!symbol) return;

    setKlines([]);
    const url = getMarketWsUrl();

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let subscribed = false;

    function connect() {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', symbol, interval }));
        subscribed = true;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        subscribed = false;
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function handleMessage(msg: WsMessage) {
      switch (msg.type) {
        case 'snapshot':
          // El historial viene de REST; ignorar snapshot parcial del WS
          break;

        case 'kline':
          if (msg.data) {
            callbacksRef.current.onKline?.(msg.data);
            setKlines((prev) => {
              const idx = prev.findIndex((k) => k.time === msg.data.time);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = msg.data;
                return next;
              }
              return [...prev, msg.data];
            });
          }
          break;

        case 'kline_closed':
          if (msg.data) {
            callbacksRef.current.onKlineClosed?.(msg.data);
          }
          break;

        case 'trade':
          if (msg.data) {
            callbacksRef.current.onTrade?.(msg.data);
          }
          break;
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (subscribed && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbol, interval }));
      }
      ws.close();
    };
  }, [symbol, interval]);

  const sendMessage = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, klines, sendMessage };
}
