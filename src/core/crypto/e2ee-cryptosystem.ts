/**
 * E2EECryptoUtils
 * A stateless, pure utility class utilizing the Web Crypto API.
 * Ideal for integration with external state layers like IndexedDB.
 */

export type IdentityBundle = {
  name: string;
  ecdhPublic: JsonWebKey;
  ecdsaPublic: JsonWebKey;
};

export type FullIdentityBundle = IdentityBundle & {
  ecdhPrivate: JsonWebKey;
  ecdsaPrivate: JsonWebKey;
};

export type SenderKeyBundle = {
  chainKeyHex: string;
  keyId: string;
  counter?: number;
};

export type CipherPackage = {
  ciphertext: string;
  iv: string;
};

export type GroupPayload = {
  group: string;
  keyId: string;
  counter: number;
  iv: string;
  cipher: string;
};

export type DistributedKeyPacket = {
  peer: string;
  cipher: string;
  iv: string;
};

type BinaryInput = ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

type JwkImportSubtle = Omit<SubtleCrypto, "importKey"> & {
  importKey(
    format: "jwk",
    keyData: JsonWebKey,
    algorithm: EcKeyImportParams,
    extractable: boolean,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKey>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * E2EECryptoUtils provides WebCrypto API wrappers for asymmetric identity key generation,
 * shared secret derivation, symmetric encryption, and digital signatures.
 */
class E2EECryptoUtils {
  /* ═══════════════════════════════════════════════════════════
     STATIC ENCODING & UTILITY METHODS
     ═══════════════════════════════════════════════════════════ */

  /**
   * Standardizes binary input buffers to raw ArrayBuffers.
   * 
   * @param buf - The raw buffer input (ArrayBuffer or View)
   * @returns The raw ArrayBuffer
   */
  static toArrayBuffer(buf: BinaryInput): ArrayBuffer {
    if (buf instanceof ArrayBuffer) {
      return buf;
    }
    return Uint8Array.from(
      new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    ).buffer;
  }

  /**
   * Encodes a binary input buffer into a hexadecimal string.
   * 
   * @param buf - The binary buffer input to encode
   * @returns Hexadecimal string representation
   */
  static toHex(buf: BinaryInput): string {
    const bytes = new Uint8Array(E2EECryptoUtils.toArrayBuffer(buf));
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Decodes a hexadecimal string back into a Uint8Array byte sequence.
   * 
   * @param hex - Hexadecimal string input
   * @returns Uint8Array byte sequence
   */
  static fromHex(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g) ?? [];
    return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  }

  /**
   * Encodes a binary input buffer into a standard Base64 string.
   * 
   * @param buf - The binary buffer to encode
   * @returns Base64 string representation
   */
  static toB64(buf: BinaryInput): string {
    const bytes = new Uint8Array(E2EECryptoUtils.toArrayBuffer(buf));
    return btoa(String.fromCharCode(...bytes));
  }

  /**
   * Decodes a standard Base64 string back to a raw ArrayBuffer.
   * 
   * @param b64 - Base64 encoded string
   * @returns Raw decoded ArrayBuffer
   */
  static fromB64(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr.buffer;
  }

  /**
   * Gathers high-entropy random bytes using the cryptographically secure random number generator.
   * 
   * @param n - Number of random bytes to generate
   * @returns Uint8Array filled with cryptographically secure random values
   */
  static randomBytes(n: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  /* ═══════════════════════════════════════════════════════════
     IDENTITY MANAGEMENT (ECDH & ECDSA)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Generates decentralized identity asymmetric key pairs for ECDH key agreements and ECDSA signing.
   * 
   * @param name - Display name/alias to bundle inside the metadata
   * @returns Promise resolving to a full set of public and private JWK representations
   */
  static async generateIdentity(name: string): Promise<FullIdentityBundle> {
    const identityName =
      name.trim() || "user_" + E2EECryptoUtils.randomBytes(2)[0];

    const ecdhPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"],
    );

    const ecdsaPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );

    return {
      name: identityName,
      ecdhPublic: await crypto.subtle.exportKey("jwk", ecdhPair.publicKey),
      ecdhPrivate: await crypto.subtle.exportKey("jwk", ecdhPair.privateKey),
      ecdsaPublic: await crypto.subtle.exportKey("jwk", ecdsaPair.publicKey),
      ecdsaPrivate: await crypto.subtle.exportKey("jwk", ecdsaPair.privateKey),
    };
  }

  /* ═══════════════════════════════════════════════════════════
     1-TO-1 CRYPTOGRAPHY (ECDH agreement & HKDF)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Derives a shared symmetric secret key (AES-GCM format) between two peers using
   * a local ECDH private key and a peer's public ECDH key, fanned through HKDF.
   * 
   * @param localEcdhPrivJwk - Local private key represented as JWK
   * @param peerEcdhPubJwk - Remote peer's public key represented as JWK
   * @returns Derived 256-bit symmetric key as a hexadecimal string
   */
  static async deriveSharedSecret(
    localEcdhPrivJwk: JsonWebKey,
    peerEcdhPubJwk: JsonWebKey,
  ): Promise<string> {
    const localPrivKey = await (crypto.subtle as JwkImportSubtle).importKey(
      "jwk",
      localEcdhPrivJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );

    const peerPubKey = await (crypto.subtle as JwkImportSubtle).importKey(
      "jwk",
      peerEcdhPubJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );

    const rawSharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: peerPubKey },
      localPrivKey,
      256,
    );

    const derivedAesKey = await E2EECryptoUtils._hkdfFromBuffer(
      rawSharedBits,
      "e2ee-ecdh-derived",
    );
    const rawAesBytes = await crypto.subtle.exportKey("raw", derivedAesKey);

    return E2EECryptoUtils.toHex(rawAesBytes);
  }

  /**
   * Derives a cryptographic CryptoKey using the HKDF KDF standard.
   * 
   * @param ikm - Input Key Material buffer
   * @param infoText - Contextual info text string for unique binding
   * @param saltBuffer - Cryptographic salt (falls back to zeros if omitted)
   * @param bitLength - Length of derived key in bits
   * @returns Promise resolving to a CryptoKey usable for AES-GCM
   */
  static async _hkdfFromBuffer(
    ikm: BinaryInput,
    infoText: string,
    saltBuffer: BinaryInput | null = null,
    bitLength = 256,
  ): Promise<CryptoKey> {
    const ikmCryptoKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(ikm),
      "HKDF",
      false,
      ["deriveKey"],
    );
    const saltBytes = saltBuffer
      ? E2EECryptoUtils.toArrayBuffer(saltBuffer)
      : new Uint8Array(32).buffer;

    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: saltBytes,
        info: encoder.encode(infoText),
      },
      ikmCryptoKey,
      { name: "AES-GCM", length: bitLength },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Derives a hexadecimal key from input parameters using HKDF.
   * 
   * @param ikmRaw - Input Key Material as string or hex
   * @param infoText - Unique context binding string
   * @param saltRaw - Cryptographic salt as string or hex
   * @param bitLength - Length of derived key in bits
   * @returns Derived key as a hexadecimal string
   */
  static async runManualHKDF(
    ikmRaw: string,
    infoText: string,
    saltRaw = "",
    bitLength = 256,
  ): Promise<string> {
    const ikm = ikmRaw.match(/^[0-9a-f]+$/i)
      ? E2EECryptoUtils.fromHex(ikmRaw)
      : encoder.encode(ikmRaw);
    const salt = saltRaw
      ? saltRaw.match(/^[0-9a-f]+$/i)
      : encoder.encode(saltRaw);

    const key = await E2EECryptoUtils._hkdfFromBuffer(
      ikm as Uint8Array,
      infoText,
      salt ? (salt as Uint8Array) : null,
      bitLength,
    );
    const rawExport = await crypto.subtle.exportKey("raw", key);
    return E2EECryptoUtils.toHex(rawExport);
  }

  /* ═══════════════════════════════════════════════════════════
     SYMMETRIC ENCRYPTION / DECRYPTION LAYER (AES-GCM-256)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Encrypts plaintext string using 1-to-1 AES-GCM-256 key agreement.
   * 
   * @param sharedHexKey - Derived shared secret symmetric key (hex format)
   * @param plaintext - Text data to encrypt
   * @returns CipherPackage with Base64 ciphertext and IV
   */
  static async encrypt1to1(
    sharedHexKey: string,
    plaintext: string,
  ): Promise<CipherPackage> {
    return E2EECryptoUtils.encryptWithManualHexKey(sharedHexKey, plaintext);
  }

  /**
   * Decrypts AES-GCM-256 encrypted ciphertext using the shared secret key.
   * 
   * @param sharedHexKey - Derived shared secret symmetric key (hex format)
   * @param ciphertextB64 - Ciphertext data encoded as Base64
   * @param ivB64 - Initialization Vector encoded as Base64
   * @returns Cleartext string representation
   */
  static async decrypt1to1(
    sharedHexKey: string,
    ciphertextB64: string,
    ivB64: string,
  ): Promise<string> {
    return E2EECryptoUtils.decryptWithManualHexKey(
      sharedHexKey,
      ciphertextB64,
      ivB64,
    );
  }

  /**
   * Encrypts plaintext using a raw hex key with AES-GCM.
   * 
   * @param hexKey - The 256-bit AES key as a 64-character hexadecimal string
   * @param plaintext - Cleartext string data to encrypt
   * @returns CipherPackage containing Base64 encoded ciphertext and initialization vector
   */
  static async encryptWithManualHexKey(
    hexKey: string,
    plaintext: string,
  ): Promise<CipherPackage> {
    if (hexKey.length !== 64) {
      throw new Error(
        "Key dimension variance error. Must be 64 hex characters.",
      );
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(E2EECryptoUtils.fromHex(hexKey)),
      "AES-GCM",
      false,
      ["encrypt"],
    );
    const iv = E2EECryptoUtils.randomBytes(12);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: E2EECryptoUtils.toArrayBuffer(iv) },
      cryptoKey,
      encoder.encode(plaintext),
    );

    return {
      ciphertext: E2EECryptoUtils.toB64(cipherBuffer),
      iv: E2EECryptoUtils.toB64(iv),
    };
  }

  /**
   * Decrypts ciphertext using a raw hex key with AES-GCM.
   * 
   * @param hexKey - The 256-bit AES key as a 64-character hexadecimal string
   * @param ciphertextB64 - Base64 encoded ciphertext
   * @param ivB64 - Base64 encoded initialization vector
   * @returns Decoded plaintext UTF-8 string
   */
  static async decryptWithManualHexKey(
    hexKey: string,
    ciphertextB64: string,
    ivB64: string,
  ): Promise<string> {
    if (hexKey.length !== 64) {
      throw new Error("Key alignment configuration dimension variance error.");
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(E2EECryptoUtils.fromHex(hexKey)),
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: E2EECryptoUtils.fromB64(ivB64) },
      cryptoKey,
      E2EECryptoUtils.fromB64(ciphertextB64),
    );
    return decoder.decode(plainBuffer);
  }

  /* ═══════════════════════════════════════════════════════════
     DIGITAL SIGNATURE MANAGEMENT (ECDSA)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Signs a message string using ECDSA P-256 private key and SHA-256 hash.
   * 
   * @param localEcdsaPrivJwk - The private signing key as JWK
   * @param messageText - Text message data to sign
   * @returns Base64 signature string representing raw coordinates
   */
  static async signMessage(
    localEcdsaPrivJwk: JsonWebKey,
    messageText: string,
  ): Promise<string> {
    const privateKey = await (crypto.subtle as JwkImportSubtle).importKey(
      "jwk",
      localEcdsaPrivJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(messageText),
    );
    return E2EECryptoUtils.toB64(signatureBuffer);
  }

  /**
   * Verifies an ECDSA P-256 signature against public verification JWK parameters.
   * 
   * @param ecdsaPublicKeyJWK - The public verification key as JWK
   * @param messageText - Original text message data
   * @param signatureB64 - Base64 encoded signature string
   * @returns Boolean verification result
   */
  static async verifySignature(
    ecdsaPublicKeyJWK: JsonWebKey,
    messageText: string,
    signatureB64: string,
  ): Promise<boolean> {
    const publicVerificationKey = await (
      crypto.subtle as JwkImportSubtle
    ).importKey(
      "jwk",
      ecdsaPublicKeyJWK,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicVerificationKey,
      E2EECryptoUtils.fromB64(signatureB64),
      encoder.encode(messageText),
    );
  }

  /* ═══════════════════════════════════════════════════════════
     GROUP CRYPTOGRAPHY (Sender Keys & HMAC Ratchets)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Generates a structural Sender Key bundle containing randomized chain key and identifier.
   * 
   * @returns Promise resolving to the newly allocated key bundle
   */
  static async generateSenderKey(): Promise<SenderKeyBundle> {
    const chainKeyBytes = E2EECryptoUtils.randomBytes(32);
    const keyIdBytes = E2EECryptoUtils.randomBytes(8);

    return {
      chainKeyHex: E2EECryptoUtils.toHex(chainKeyBytes),
      keyId: E2EECryptoUtils.toHex(keyIdBytes),
    };
  }

  /**
   * Encrypts and distributes a sender key bundle to a specific peer using ECDH shared secret.
   * 
   * @param peerName - Remote peer identifier
   * @param sharedHexKey - Derived shared secret symmetric key
   * @param groupName - Targeted chat room/group identifier
   * @param senderKeyBundle - Current chain key material to package and send
   * @returns DistributedKeyPacket containing encrypted ciphertext and IV
   */
  static async distributeSenderKeyToPeer(
    peerName: string,
    sharedHexKey: string,
    groupName: string,
    senderKeyBundle: SenderKeyBundle,
  ): Promise<DistributedKeyPacket> {
    const peerSymmetricCryptoKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(E2EECryptoUtils.fromHex(sharedHexKey)),
      "AES-GCM",
      false,
      ["encrypt"],
    );

    const iv = E2EECryptoUtils.randomBytes(12);
    const deliveryPayloadBytes = encoder.encode(
      JSON.stringify({
        group: groupName,
        chainKeyHex: senderKeyBundle.chainKeyHex,
        keyId: senderKeyBundle.keyId,
        counter: senderKeyBundle.counter || 0,
      }),
    );

    const payloadEncryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: E2EECryptoUtils.toArrayBuffer(iv) },
      peerSymmetricCryptoKey,
      deliveryPayloadBytes,
    );

    return {
      peer: peerName,
      cipher: E2EECryptoUtils.toB64(payloadEncryptedBuffer),
      iv: E2EECryptoUtils.toB64(iv),
    };
  }

  /**
   * Advances the chain key ratchets via HMAC-SHA256, deriving a one-time message key
   * and returning the next advanced chain key for future transmissions.
   * 
   * @param groupName - Group identifier
   * @param messageText - Raw plaintext message content
   * @param currentChainKeyHex - Current chain key state (hex format)
   * @param keyId - Active sender key identifier
   * @param currentRatchetCount - The current counter index for tracking the message sequence
   * @returns Encrypted envelope payload, advanced chain key hex, and derived raw message key
   */
  static async groupEncrypt(
    groupName: string,
    messageText: string,
    currentChainKeyHex: string,
    keyId: string,
    currentRatchetCount: number,
  ): Promise<{
    transportPayload: GroupPayload;
    nextChainKeyHex: string;
    messageKeyBuffer: ArrayBuffer;
  }> {
    const currentChainBuffer = E2EECryptoUtils.fromHex(currentChainKeyHex);

    const hmacStructuralBaseKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(currentChainBuffer),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const derivedMessageKeyBuffer = await crypto.subtle.sign(
      "HMAC",
      hmacStructuralBaseKey,
      encoder.encode("Message Key"),
    );
    const advancedChainBuffer = await crypto.subtle.sign(
      "HMAC",
      hmacStructuralBaseKey,
      encoder.encode("Chain Key"),
    );
    const advancedChainHex = E2EECryptoUtils.toHex(advancedChainBuffer);

    const executionAesGCMKey = await crypto.subtle.importKey(
      "raw",
      derivedMessageKeyBuffer,
      "AES-GCM",
      true,
      ["encrypt"],
    );
    const iv = E2EECryptoUtils.randomBytes(12);
    const internalCipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: E2EECryptoUtils.toArrayBuffer(iv) },
      executionAesGCMKey,
      encoder.encode(messageText),
    );

    const transportPayload = {
      group: groupName,
      keyId: keyId,
      counter: currentRatchetCount + 1,
      iv: E2EECryptoUtils.toB64(iv),
      cipher: E2EECryptoUtils.toB64(internalCipherBuffer),
    };

    return {
      transportPayload,
      nextChainKeyHex: advancedChainHex,
      messageKeyBuffer: derivedMessageKeyBuffer,
    };
  }

  /**
   * Decrypts group/room broadcast signal packet using derived ratchet message key material.
   * 
   * @param broadcastPayload - Received group payload metadata
   * @param workingMessageKeyMaterial - The derived sequence-specific message key
   * @returns Cleartext string representation
   */
  static async groupDecrypt(
    broadcastPayload: GroupPayload,
    workingMessageKeyMaterial: ArrayBuffer,
  ): Promise<string> {
    const functionalDecryptionKey = await crypto.subtle.importKey(
      "raw",
      E2EECryptoUtils.toArrayBuffer(workingMessageKeyMaterial),
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const decodedBufferOutput = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: E2EECryptoUtils.fromB64(broadcastPayload.iv),
      },
      functionalDecryptionKey,
      E2EECryptoUtils.fromB64(broadcastPayload.cipher),
    );

    return decoder.decode(decodedBufferOutput);
  }

  /* ═══════════════════════════════════════════════════════════
     GENERIC HASHING UTILITIES (SHA-256 / HMAC)
     ═══════════════════════════════════════════════════════════ */

  /**
   * Generates SHA-256 hash string representation of text data.
   * 
   * @param text - Plaintext string
   * @returns Hexadecimal hashed output
   */
  static async sha256(text: string): Promise<string> {
    const resultBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(text),
    );
    return E2EECryptoUtils.toHex(resultBuffer);
  }

  /**
   * Generates HMAC-SHA256 signature string using a symmetric secret key.
   * 
   * @param secretKeyText - Secret key string
   * @param messageText - Text message data to sign
   * @returns Hexadecimal HMAC signature representation
   */
  static async hmacSha256(
    secretKeyText: string,
    messageText: string,
  ): Promise<string> {
    const rawSignatureKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKeyText),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const processingResultMacBuffer = await crypto.subtle.sign(
      "HMAC",
      rawSignatureKey,
      encoder.encode(messageText),
    );
    return E2EECryptoUtils.toHex(processingResultMacBuffer);
  }
}

export { E2EECryptoUtils };
