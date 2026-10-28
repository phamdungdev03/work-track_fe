"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useDemoClock() {
  const [now, setNow] = useState(() => Date.now());
  const [demo, setDemo] = useState(false);
  const anchor = useRef<{ epoch: number; monotonic: number } | null>(null);
  const readNow = useCallback(
    () =>
      anchor.current
        ? anchor.current.epoch + performance.now() - anchor.current.monotonic
        : Date.now(),
    [],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(readNow()), 250);
    return () => clearInterval(timer);
  }, [readNow]);
  const apply = useCallback((input: string): boolean => {
    const epoch = Date.parse(`${input}+07:00`);
    if (!Number.isFinite(epoch)) return false;
    anchor.current = { epoch, monotonic: performance.now() };
    setNow(epoch);
    setDemo(true);
    return true;
  }, []);
  const reset = useCallback(() => {
    anchor.current = null;
    setNow(Date.now());
    setDemo(false);
  }, []);
  return { now, demo, readNow, apply, reset };
}
