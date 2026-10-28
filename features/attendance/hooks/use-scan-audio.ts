"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "../types";

export function useScanAudio() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(45);
  const [issue, setIssue] = useState("");
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const generation = useRef(0);
  const options = useRef({ enabled, volume });

  const stop = useCallback(() => {
    generation.current += 1;
    source.current?.stop();
    source.current = null;
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    options.current = { enabled, volume };
    if (!enabled || volume === 0) stop();
    if (gain.current) gain.current.gain.value = volume / 100;
  }, [enabled, volume, stop]);
  useEffect(
    () => () => {
      stop();
      void context.current?.close();
    },
    [stop],
  );

  const unlock = useCallback(() => {
    if (!options.current.enabled || options.current.volume === 0) return;
    try {
      context.current ??= new AudioContext();
      void context.current
        .resume()
        .catch(() =>
          setIssue("Trình duyệt chưa cho phép âm thanh. Bấm Nghe thử."),
        );
    } catch {
      setIssue("Trình duyệt không hỗ trợ âm thanh. Kết quả vẫn được hiển thị.");
    }
  }, []);

  const speak = useCallback(
    (text: string, clip: string, missingName = false, preferRecording = false) => {
      stop();
      if (!options.current.enabled || options.current.volume === 0) return;
      const ticket = generation.current;
      setIssue("");
      const fallback = async () => {
        try {
          const ctx = context.current;
          if (!ctx || ctx.state !== "running") throw new Error("audio locked");
          let buffer = buffers.current.get(clip);
          if (!buffer) {
            const response = await fetch(`/audio/${clip}.wav`);
            if (!response.ok) throw new Error("audio unavailable");
            buffer = await ctx.decodeAudioData(await response.arrayBuffer());
            buffers.current.set(clip, buffer);
          }
          if (ticket !== generation.current) return;
          const player = ctx.createBufferSource();
          const level = ctx.createGain();
          player.buffer = buffer;
          level.gain.value = options.current.volume / 100;
          player.connect(level);
          level.connect(ctx.destination);
          source.current = player;
          gain.current = level;
          player.onended = () => {
            if (source.current === player) source.current = null;
          };
          player.start();
          if (missingName)
            setIssue(
              "Chưa có bản thu tên này. Đang dùng lời chào chung; tên đầy đủ vẫn hiển thị.",
            );
        } catch {
          if (ticket !== generation.current) return;
          const synth = window.speechSynthesis;
          const voice = preferRecording && synth?.getVoices().find(
            (item) => item.localService && /^vi(?:[-_]|$)/i.test(item.lang),
          );
          if (voice) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voice;
            utterance.lang = "vi-VN";
            utterance.volume = options.current.volume / 100;
            utterance.onerror = () => setIssue("Chưa phát được âm thanh. Bấm Nghe thử; dữ liệu chấm công không bị ảnh hưởng.");
            synth.speak(utterance);
          } else setIssue("Chưa phát được âm thanh. Bấm Nghe thử; dữ liệu chấm công không bị ảnh hưởng.");
        }
      };
      if (preferRecording) {
        void fallback();
        return;
      }
      const synth = window.speechSynthesis;
      const voice = synth
        ?.getVoices()
        .find((item) => item.localService && /^vi(?:[-_]|$)/i.test(item.lang));
      if (voice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = "vi-VN";
        utterance.volume = options.current.volume / 100;
        utterance.onerror = () => {
          if (generation.current === ticket) void fallback();
        };
        synth.speak(utterance);
      } else void fallback();
    },
    [stop],
  );

  const announce = useCallback(
    (result: ScanResult) => {
      if (result.scan.outcome === "ACCEPTED") {
        const name =
          result.scan.decision_snapshot.employee_name ??
          result.scan.employee_name ??
          "";
        const match = /^Nhân viên Demo (\d{3})$/.exec(name);
        const number = match ? Number(match[1]) : 0;
        const hasClip = number >= 1 && number <= 100;
        speak(
          result.message,
          `${result.scan.event_type}${hasClip ? `-${match![1]}` : ""}`,
          !hasClip,
          hasClip,
        );
      } else {
        const supported = [
          "COOLDOWN",
          "BACKDATED_SCAN",
          "NO_FACE",
          "UNREGISTERED",
          "EMPLOYEE_INACTIVE",
          "FACILITY_INACTIVE",
          "QR_INVALID",
          "QR_WRONG_FACILITY",
          "QR_REVOKED",
          "QR_EXPIRED",
          "QR_ALREADY_USED",
          "QR_MISSING",
          "GPS_UNAVAILABLE",
          "GPS_OUT_OF_RANGE",
        ];
        speak(
          result.message,
          supported.includes(result.scan.reason_code)
            ? result.scan.reason_code
            : "ERROR",
          false,
          supported.includes(result.scan.reason_code),
        );
      }
    },
    [speak],
  );
  const test = useCallback(
    (name: string) => {
      unlock();
      const match = /^Nhân viên Demo (\d{3})$/.exec(name);
      const supported =
        !!match && Number(match[1]) >= 1 && Number(match[1]) <= 100;
      speak(
        `Xin chào ${name}, mời vào.`,
        supported ? `IN-${match[1]}` : "IN",
        !supported,
        supported,
      );
    },
    [unlock, speak],
  );
  return {
    enabled,
    setEnabled,
    volume,
    setVolume,
    issue,
    unlock,
    speak,
    announce,
    test,
  };
}
