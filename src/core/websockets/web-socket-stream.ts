import { E2EECryptoUtils } from "../crypto/e2ee-cryptosystem";
import type { Envelope, CommandPayload, Base64 } from "./types/websocket.type";
import { wsLog, hsLog, logger } from "../logger";

interface StreamResolver<T> {
  resolve: (value: IteratorResult<T>) => void;
  reject: (err: unknown) => void;
}

/**
 * WebSocketStream implements a full-duplex asynchronous pipeline
 * that upgrades connection states, processes incoming tickets,
 * signs handshake credentials, and queues stream data.
 *
 * @template T Type of envelope packets transferred over this stream
 */
export class WebSocketStream<T = unknown> implements AsyncIterable<T> {
  private url: string;
  private backendUrl: string;
  private maxBufferSize: number;
  private buffer: T[] = [];
  private resolvers: StreamResolver<T>[] = [];
  private isClosed: boolean = false;
  private error: Error | null = null;
  private socket: WebSocket | null = null;
  // Outgoing envelopes queued while the socket is mid-reconnect (not yet OPEN).
  // Without this, any send() attempted during the brief window between a
  // dropped connection and the next successful AUTH_OK -- e.g. group sender-key
  // distribution firing off a ROOM_MEMBERS/REQUEST_SENDER_KEYS event right as a
  // reconnect is in flight -- throws and is silently swallowed by the caller's
  // try/catch, permanently losing that packet. Queueing and flushing on reopen
  // makes send() best-effort-reliable across reconnects instead of drop-on-throw.
  private outgoingQueue: T[] = [];

  /**
   * Constructs an instance of the full-duplex stream manager.
   *
   * @param url - The target WebSocket gateway endpoint (e.g. ws://localhost:8080/ws)
   * @param backendUrl - The tactical HTTP backend API origin
   * @param maxBufferSize - Hard thresholds on buffered stream capacity before purging
   */
  constructor(url: string, backendUrl: string, maxBufferSize: number = 1000) {
    this.url = url;
    this.backendUrl = backendUrl;
    this.maxBufferSize = maxBufferSize;
    wsLog("Stream instance created", { url, backendUrl, maxBufferSize });
  }

  /**
   * Connects to the secure entry gateway, signs a transient handshake ticket,
   * establishes a WebSocket connection, and completes the authentication lifecycle.
   *
   * @param identityPrivateKeyJwk - The local DSA (ECDSA) private key used for authentication signatures
   * @param timeoutMs - Time limits allowed for the handshake validation flow to settle
   * @returns Resolves when the session upgrades to AUTH_OK; rejects on timeouts or failures
   */
  public async connect(
    identityPrivateKeyJwk: JsonWebKey,
    timeoutMs: number = 10_000,
  ): Promise<void> {
    hsLog(`▶ connect() called`, { url: this.url, timeoutMs });

    // Step 1: Query cross-origin token payload ticket
    hsLog("  [1/4] Fetching WS ticket from backend...");
    const ticket = await this._fetchTicket();
    hsLog("  [1/4] ✔ Ticket acquired", { preview: ticket.substring(0, 24) + "..." });

    // Step 2: Extract signatures using WebCrypto E2EE utilities
    hsLog("  [2/4] Signing ticket with ECDSA private key...");
    const signature = (await E2EECryptoUtils.signMessage(
      identityPrivateKeyJwk,
      ticket,
    )) as Base64;
    hsLog("  [2/4] ✔ Signature produced");

    // Steps 3 & 4: Establish streaming pipeline and handle auth lifecycle
    return new Promise<void>((resolve, reject) => {
      hsLog(`  [3/4] Opening WebSocket → ${this.url}`);
      const ws = new WebSocket(this.url);
      this.socket = ws; // Track reference locally to ensure listener cleanup works against exact reference

      const timer = setTimeout(() => {
        logger.warn("[WS-HANDSHAKE]", `✗ Handshake timed out after ${timeoutMs}ms`);
        cleanupAndSettle();
        ws.close();
        reject(new Error("Authentication handshake sequence timed out."));
      }, timeoutMs);

      /**
       * Clean up all temporary connection event listeners and clear the timeout timer.
       */
      const cleanupAndSettle = () => {
        clearTimeout(timer);
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("message", onMessage);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };

      /**
       * WebSocket open handler. Immediately sends the unauthenticated command handshake payload.
       */
      const onOpen = () => {
        hsLog("  [3/4] WebSocket opened — sending AUTH_REQUEST");
        const authEnvelope: Envelope = {
          id: crypto.randomUUID(),
          type: "command", // Aligned with the modern Envelope discriminated union
          to: [],
          payload: {
            code: "AUTH_REQUEST",
            message: "Initiating guest handshake",
            additional: { ticket, signature },
          },
        };
        logger.group("[WS-HANDSHAKE]", "AUTH_REQUEST envelope", authEnvelope);
        ws.send(JSON.stringify(authEnvelope));
      };

      /**
       * Message processor for the handshake phase.
       *
       * @param event - Message event containing raw envelope JSON
       */
      const onMessage = (event: MessageEvent) => {
        try {
          const pkt = JSON.parse(event.data) as Envelope;
          const code = (pkt.payload as CommandPayload)?.code;
          hsLog(`  [4/4] Handshake response received`, { type: pkt.type, code });

          if (pkt.type === "command") {
            const payload = pkt.payload as CommandPayload;

            if (payload.code === "AUTH_OK") {
              hsLog("  [4/4] ✔ AUTH_OK — binding runtime listeners & flushing queue");
              cleanupAndSettle();
              this._bindRuntimeListeners(); // Safely bind clean, permanent listeners here
              this._flushOutgoingQueue();   // Deliver anything queued while we were reconnecting
              resolve();
            } else if (payload.code === "AUTH_FAILED") {
              logger.error("[WS-HANDSHAKE]", `✗ AUTH_FAILED — ${payload.message}`);
              cleanupAndSettle();
              ws.close();
              reject(
                new Error(
                  payload.message ||
                    "Authentication explicitly rejected by host.",
                ),
              );
            } else {
              hsLog(`  Unexpected handshake code ignored: ${payload.code}`);
            }
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          logger.error("[WS-HANDSHAKE]", "Malformed handshake frame — closing");
          cleanupAndSettle();
          ws.close();
          reject(new Error("Malformed handshaking frame package returned."));
        }
      };

      /**
       * Handshake error event listener.
       */
      const onError = () => {
        logger.error("[WS-HANDSHAKE]", "WebSocket error during handshake");
        cleanupAndSettle();
        reject(
          new Error(
            "WebSocket network mapping error caught over initial handshake timeline.",
          ),
        );
      };

      /**
       * Handshake connection close listener.
       */
      const onClose = () => {
        logger.warn("[WS-HANDSHAKE]", "WebSocket closed before auth settled");
        cleanupAndSettle();
        reject(
          new Error(
            "Connection aborted before authorization frame transaction settled.",
          ),
        );
      };

      // Attach temporary listeners
      ws.addEventListener("open", onOpen);
      ws.addEventListener("message", onMessage);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
    });
  }

  /**
   * Fetches a transient, single-use infiltration ticket from the backend REST gateway.
   *
   * @returns High-entropy ticket string
   * @throws Error on failing network handshakes or unauthorized statuses
   */
  private async _fetchTicket(): Promise<string> {
    wsLog(`_fetchTicket() → ${this.backendUrl}/api/auth/ws-ticket`);
    const res = await fetch(`${this.backendUrl}/api/auth/ws-ticket`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error("[WS-STREAM]", `Ticket request failed HTTP ${res.status}`, body);
      throw new Error(
        `Failed to secure ticket block payload: ${res.status} ${body}`,
      );
    }
    const { ticket } = await res.json();
    wsLog("_fetchTicket() ✔ ticket received");
    return ticket;
  }

  /**
   * Binds runtime listeners to the established socket session for persistent message flow.
   */
  private _bindRuntimeListeners(): void {
    if (!this.socket) return;
    wsLog("_bindRuntimeListeners() — socket runtime listeners active");

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data: T = JSON.parse(event.data);
        const env = data as unknown as Envelope;
        const code = (env?.payload as CommandPayload)?.code ?? "—";
        wsLog(
          `◀ RECV  type=${env?.type ?? "?"}  code=${code}  from=${env?.from ?? "server"}  id=${env?.id ?? "?"}`,
          data,
        );
        this._push(data);
      } catch (err) {
        logger.error(
          "[WS-STREAM]",
          "Malformed application payload dropped from runtime stream",
          err,
        );
      }
    };

    this.socket.onerror = (ev) => {
      logger.error("[WS-STREAM]", "Runtime socket error", ev);
      this._panic(
        new Error("Active application stream session went fault state."),
      );
    };

    this.socket.onclose = (ev) => {
      wsLog(`Socket closed  code=${ev.code}  reason="${ev.reason || "(none)"}"  wasClean=${ev.wasClean}`);
      this._close();
    };
  }

  /**
   * Enqueues an incoming payload to the buffer, resolving any waiting consumers.
   *
   * @param data - The parsed packet data to push
   */
  private _push(data: T): void {
    if (this.isClosed) return;

    if (this.resolvers.length > 0) {
      const { resolve } = this.resolvers.shift()!;
      resolve({ value: data, done: false });
    } else if (this.buffer.length < this.maxBufferSize) {
      this.buffer.push(data);
      wsLog(`Buffered (no active consumer)  bufferSize=${this.buffer.length}`);
    } else {
      logger.warn(
        "[WS-STREAM]",
        `Buffer full (${this.maxBufferSize}) — dropping oldest packet`,
      );
      this.buffer.shift();
      this.buffer.push(data);
    }
  }

  /**
   * Panics the stream, storing the error and terminating the connection.
   *
   * @param err - The fatal stream error causing the panic
   */
  private _panic(err: Error): void {
    logger.error("[WS-STREAM]", `Stream panic: ${err.message}`);
    this.error = err;
    this._close();
  }

  /**
   * Safely closes the stream and flushes/rejects any waiting resolvers.
   */
  private _close(): void {
    wsLog(`_close()  pendingResolvers=${this.resolvers.length}`);
    this.isClosed = true;
    while (this.resolvers.length > 0) {
      const { resolve, reject } = this.resolvers.shift()!;
      if (this.error) {
        reject(this.error);
      } else {
        resolve({ value: undefined, done: true });
      }
    }
  }

  /**
   * Exposes the stream as an AsyncIterable for easy for-await-of consumption loops.
   *
   * @returns AsyncIterator interface
   */
  public [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.isClosed) {
          if (this.error) return Promise.reject(this.error);
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.resolvers.push({ resolve, reject });
        });
      },
    };
  }

  /**
   * Transmits a serialized envelope payload across the socket wire. If the
   * socket is momentarily closed/reconnecting, the envelope is queued and
   * automatically flushed the next time the connection re-opens, rather than
   * being thrown away -- callers that fire-and-forget (e.g. group sender-key
   * distribution) must not lose packets just because they raced a reconnect.
   *
   * @param envelope - The TransmissionEnvelope package to transmit
   */
  public send(envelope: T): void {
    const env = envelope as unknown as Envelope;
    const code = (env?.payload as CommandPayload)?.code ?? "—";

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      wsLog(
        `▶ SEND queued (socket not OPEN  readyState=${this.socket?.readyState})  type=${env?.type}  code=${code}`,
        envelope,
      );
      this.outgoingQueue.push(envelope);
      return;
    }
    wsLog(
      `▶ SEND  type=${env?.type}  code=${code}  to=${JSON.stringify(env?.to ?? [])}  id=${env?.id ?? "?"}`,
      envelope,
    );
    this.socket.send(JSON.stringify(envelope));
  }

  /**
   * Drains any envelopes queued while the socket was reconnecting, sending
   * them now that the connection is back open.
   */
  private _flushOutgoingQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.outgoingQueue.length === 0) return;
    wsLog(`_flushOutgoingQueue() — flushing ${this.outgoingQueue.length} queued envelopes`);
    while (this.outgoingQueue.length > 0) {
      const envelope = this.outgoingQueue.shift()!;
      const env = envelope as unknown as Envelope;
      wsLog(`  → flushing queued  type=${env?.type}  code=${(env?.payload as CommandPayload)?.code ?? "—"}`);
      this.socket.send(JSON.stringify(envelope));
    }
  }
}
