import { WebSocketStream } from "./web-socket-stream";
import type { Envelope } from "./types/websocket.type";
import { bcLog, logger } from "../logger";

const BACKEND_URL = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";
const WS_URL = import.meta.env.VITE_BACKEND_WS_URL
  ? `${import.meta.env.VITE_BACKEND_WS_URL}/ws`
  : "ws://localhost:8080/ws";

bcLog("Global stream module loaded", { BACKEND_URL, WS_URL });

/**
 * Global WebSocket stream wrapper instance managing active message transmission pipeline.
 * Routes raw events incoming from node's edge interface.
 */
export const globalChatStream = new WebSocketStream<Envelope>(
  WS_URL,
  BACKEND_URL,
  2000,
);

type ChatStreamCallback = (data: Envelope) => void;
const listeners = new Set<ChatStreamCallback>();
const messageQueue: Envelope[] = [];

/**
 * Initializes and consumes the active packet streaming pipeline.
 * Safe extraction loop to fan out decrypted/control payloads to active listeners.
 *
 * @returns Promise void
 */
const startBroadcasting = async (): Promise<void> => {
  bcLog("Broadcasting loop started — awaiting packets from stream");
  try {
    for await (const payload of globalChatStream) {
      bcLog(
        `Packet received  type=${payload.type}  listeners=${listeners.size}  queued=${messageQueue.length}`,
        payload,
      );
      if (listeners.size === 0) {
        bcLog("No listeners active — queuing packet for later delivery");
        messageQueue.push(payload);
      } else {
        listeners.forEach((callback) => {
          try {
            callback(payload);
          } catch (err) {
            logger.error("[WS-BROADCAST]", "Listener threw an error processing packet", err);
          }
        });
      }
    }
  } catch (error) {
    logger.error("[WS-BROADCAST]", "Global Chat Stream halted unexpectedly", error);
  }
  bcLog("Broadcasting loop ended");
};

// Ignite the consumer loop
startBroadcasting();

/**
 * Subscribes a handler callback to the global broadcast stream.
 * Returns an unsubscription teardown function.
 *
 * @param callback - Event listener handling incoming envelope packages
 * @returns Function to clean up the registered listener
 */
export const subscribeToChatStream = (callback: ChatStreamCallback): (() => void) => {
  listeners.add(callback);
  bcLog(`Subscriber registered  total=${listeners.size}`);

  // Flush any queued messages to the newly registered listener
  if (messageQueue.length > 0) {
    bcLog(`Flushing ${messageQueue.length} queued packet(s) to new listener`);
    setTimeout(() => {
      while (messageQueue.length > 0) {
        const payload = messageQueue.shift();
        if (payload) {
          try {
            bcLog("Delivering queued packet to listener", payload);
            callback(payload);
          } catch (callbackErr) {
            logger.error("[WS-BROADCAST]", "Failed to execute callback for queued envelope", callbackErr);
          }
        }
      }
    }, 0);
  }

  return () => {
    listeners.delete(callback);
    bcLog(`Subscriber removed  total=${listeners.size}`);
  };
};

// Expose for quick inspection in the browser DevTools console:
//   window.__shadowStream.messageQueue, .listeners, etc.
(window as unknown as Record<string, unknown>)["__shadowStream"] = {
  globalChatStream,
  listeners,
  messageQueue,
};
bcLog("window.__shadowStream exposed for DevTools inspection");
