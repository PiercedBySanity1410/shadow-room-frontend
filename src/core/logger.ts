/**
 * ShadowRoom — Centralized Debug Logger
 *
 * Color-coded, namespaced console output for every subsystem.
 * Control verbosity via VITE_LOG_LEVEL in your .env file.
 *
 *   VITE_LOG_LEVEL=debug   → everything (default)
 *   VITE_LOG_LEVEL=info    → info, warn, error
 *   VITE_LOG_LEVEL=warn    → warn, error only
 *   VITE_LOG_LEVEL=error   → errors only
 *   VITE_LOG_LEVEL=off     → silence all logs
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "off";

const LOG_LEVEL: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) ?? "debug";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
  off:   99,
};

const COLORS: Record<string, string> = {
  "[WS-STREAM]":        "#4fc3f7", // light blue
  "[WS-HANDSHAKE]":     "#80deea", // teal
  "[WS-BROADCAST]":     "#b3e5fc", // pale blue
  "[IDENTITY]":         "#ce93d8", // purple
  "[CRYPTO]":           "#f48fb1", // pink
  "[MSG-SYSTEM]":       "#ffcc80", // amber
  "[CHAT-CONTAINER]":   "#a5d6a7", // green
  "[CHAT-ROOM-JOIN]":   "#69f0ae", // bright green
  "[ACTIVE-CHAT]":      "#fff59d", // yellow
  "[DB]":               "#ef9a9a", // soft red
  "[MODAL]":            "#b0bec5", // grey-blue
  "[RECEIPT]":          "#80cbc4", // mint
  "[SECURITY]":         "#ff5252", // bright red
};

function badge(tag: string): [string, string] {
  const color = COLORS[tag] ?? "#aaaaaa";
  return [
    `%c${tag}%c`,
    `background:${color};color:#000;padding:1px 6px;border-radius:4px;font-weight:bold;font-size:11px`,
  ];
}

function isEnabled(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

export const logger = {
  debug(tag: string, message: string, ...data: unknown[]): void {
    if (!isEnabled("debug")) return;
    const [b, s] = badge(tag);
    console.debug(b + " " + message, s, "", ...data);
  },

  info(tag: string, message: string, ...data: unknown[]): void {
    if (!isEnabled("info")) return;
    const [b, s] = badge(tag);
    console.info(b + " " + message, s, "", ...data);
  },

  warn(tag: string, message: string, ...data: unknown[]): void {
    if (!isEnabled("warn")) return;
    const [b, s] = badge(tag);
    console.warn(b + " " + message, s, "", ...data);
  },

  error(tag: string, message: string, ...data: unknown[]): void {
    if (!isEnabled("error")) return;
    const [b, s] = badge(tag);
    console.error(b + " " + message, s, "", ...data);
  },

  /** Collapsed group — good for packet payloads */
  group(tag: string, title: string, data?: unknown): void {
    if (!isEnabled("debug")) return;
    const [b, s] = badge(tag);
    console.groupCollapsed(b + " " + title, s, "");
    if (data !== undefined) console.log(data);
    console.groupEnd();
  },

  /** Expanded group — for important milestones */
  groupOpen(tag: string, title: string, data?: unknown): void {
    if (!isEnabled("info")) return;
    const [b, s] = badge(tag);
    console.group(b + " " + title, s, "");
    if (data !== undefined) console.log(data);
    console.groupEnd();
  },
};

// ─── Per-subsystem shorthands ──────────────────────────────────────────────
export const wsLog    = (msg: string, ...d: unknown[]) => logger.debug("[WS-STREAM]",      msg, ...d);
export const hsLog    = (msg: string, ...d: unknown[]) => logger.info( "[WS-HANDSHAKE]",   msg, ...d);
export const bcLog    = (msg: string, ...d: unknown[]) => logger.debug("[WS-BROADCAST]",   msg, ...d);
export const idLog    = (msg: string, ...d: unknown[]) => logger.info( "[IDENTITY]",       msg, ...d);
export const cryptoLog= (msg: string, ...d: unknown[]) => logger.debug("[CRYPTO]",         msg, ...d);
export const msgLog   = (msg: string, ...d: unknown[]) => logger.debug("[MSG-SYSTEM]",     msg, ...d);
export const chatLog  = (msg: string, ...d: unknown[]) => logger.debug("[CHAT-CONTAINER]", msg, ...d);
export const roomLog  = (msg: string, ...d: unknown[]) => logger.info( "[CHAT-ROOM-JOIN]", msg, ...d);
export const acLog    = (msg: string, ...d: unknown[]) => logger.debug("[ACTIVE-CHAT]",    msg, ...d);
export const dbLog    = (msg: string, ...d: unknown[]) => logger.debug("[DB]",             msg, ...d);
export const modalLog = (msg: string, ...d: unknown[]) => logger.debug("[MODAL]",          msg, ...d);
export const rcptLog  = (msg: string, ...d: unknown[]) => logger.debug("[RECEIPT]",        msg, ...d);
export const secLog   = (msg: string, ...d: unknown[]) => logger.warn( "[SECURITY]",       msg, ...d);
