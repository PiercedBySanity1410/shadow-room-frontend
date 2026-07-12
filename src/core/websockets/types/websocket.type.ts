// --- Brands for Stronger Type Safety ---
// Prevents accidentally mixing up raw strings with encoded strings
export type Base64 = string & { readonly __brand: "base64" };
export type Base64Url = string & { readonly __brand: "base64url" };

// --- Layer 1: Envelope (Discriminated Union) ---

export interface BaseEnvelope {
  id: string;
  readonly from?: string; // Read-only: Set by the relay
  to: string[]; // Recipients
  readonly timestamp?: number; // Read-only: Set by the relay
}

export interface CommandEnvelope extends BaseEnvelope {
  type: "command";
  payload: CommandPayload;
}

export interface MessageEnvelope extends BaseEnvelope {
  type: "message"; // Expand as needed
  payload: MessagePayload;
}

export type Envelope = CommandEnvelope | MessageEnvelope;

// --- Layer 2: Payloads ---

/** Sent by client during guest handshake */
export interface AuthPayload {
  ticket: string;
  signature: Base64; // raw 64-byte R||S
}

/** Sent by server as a handshake response or error status */
export interface CommandPayload {
  code: string; // Made required for predictable error/status handling
  message?: string;
  targetId?: string;
  passphrase?: string;
  additional?: AuthPayload;
  signature?: string;
}

/** Application Message Content */
export interface MessagePayload {
  from: SenderInfo;
  contentType: string;
  encryption: EncryptionInfo;
  ciphertext: Base64;
  sig: PayloadSignature;
  meta?: Record<string, unknown>;
}

export interface SenderInfo {
  id: string;
  deviceId?: string; // Made required to prevent replay attacks across multiple devices
}

export type EncryptionAlgorithm = "AES-GCM-256"; // More specific

export interface EncryptionInfo {
  alg: EncryptionAlgorithm;
  iv: Base64; // 12 bytes
  ephemeralPublicKey?: JWKPub;
  keyId?: string;
}

export interface JWKPub {
  kty: "EC";
  crv: "P-256";
  x: Base64Url;
  y: Base64Url;
}

export interface PayloadSignature {
  alg: "ECDSA-P256-SHA256";
  value: Base64; // raw 64-byte R||S
}
