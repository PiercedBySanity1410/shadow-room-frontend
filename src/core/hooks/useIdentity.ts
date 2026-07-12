import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { db } from "../../db/database"; // Your Dexie instance
import { E2EECryptoUtils } from "../crypto/e2ee-cryptosystem";
import { globalChatStream } from "../websockets/global-stream";
import { idLog, logger } from "../logger";

/**
 * Operative credentials profile returned from Go authentication endpoints.
 */
type User = {
  id: string;
  codename: string;
  incognitoId: string;
};

/**
 * Custom hook managing authentication lifecycle and network registry synchronization.
 * Checks local storage cache for a registered `user_id`, retrieves public key components,
 * requests a volatile network challenge nonce, verifies the signed nonce with the server,
 * and ignites the global WebSocket broadcast channel.
 *
 * @returns Object containing the authenticated user profile state, loading indicator, and a refetch function
 */
export const useIdentity = () => {
  const [data, setData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guard against concurrent StrictMode dual execution
  const isAuthenticating = useRef(false);

  /**
   * Triggers the challenge-response authentication protocol with the mesh network.
   * Resolves the current session or resets the profile context.
   */
  const authenticate = async () => {
    // If an auth pass is already inflight, drop concurrent requests
    if (isAuthenticating.current) {
      idLog("Skipping duplicate auth call — already in-flight");
      return;
    }
    isAuthenticating.current = true;
    idLog("▶ authenticate() started");

    try {
      setIsLoading(true);

      const userId = localStorage.getItem("user_id");
      if (!userId) {
        idLog("No user_id in localStorage — user is not registered");
        setData(null);
        return;
      }
      idLog("user_id found in localStorage", { userId });

      // Construct the DSA-specific primary key string
      const dsaKeyId = `${userId}:dsa`;
      idLog(`Looking up DSA key in IndexedDB`, { dsaKeyId });

      // Fetch the DSA key record from the database
      const keyRecord = await db.keys.get(dsaKeyId);

      // Verify the private key exists
      if (!keyRecord?.privateKey) {
        logger.warn("[IDENTITY]", "DSA private key missing in IndexedDB — cannot proceed with auth");
        setData(null);
        return;
      }
      idLog("DSA key record found in IndexedDB ✔");

      const backendUrl = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";

      // 1. Request challenge nonce from Go server
      idLog(`[1/4] Requesting challenge nonce`, { endpoint: `${backendUrl}/api/auth/challenge`, operativeId: userId });
      const challengeRes = await axios.post(
        `${backendUrl}/api/auth/challenge`,
        { operativeId: userId }, // Map to the Go server's expected DTO variable
      );
      const { nonce } = challengeRes.data;
      idLog(`[1/4] ✔ Challenge nonce received`, { nonce: nonce?.substring(0, 24) + "..." });

      // Grab the private key from the DSA record
      const privateKeyJwk = keyRecord.privateKey;

      // 3. Sign challenge nonce by passing the key directly
      idLog("[2/4] Signing nonce with ECDSA private key...");
      const signatureBase64 = await E2EECryptoUtils.signMessage(
        privateKeyJwk,
        nonce,
      );
      idLog("[2/4] ✔ Nonce signed successfully");

      // 4. Exchange signature for session
      idLog(`[3/4] Sending signed nonce to verify endpoint`, { endpoint: `${backendUrl}/api/auth/verify` });
      const authRes = await axios.post(
        `${backendUrl}/api/auth/verify`,
        {
          operativeId: userId,
          signature: signatureBase64,
        },
        {
          withCredentials: true, // Transmits the HTTP-Only cookie seamlessly
        },
      );
      idLog("[3/4] ✔ Session established", { codename: authRes.data.codename, incognitoId: authRes.data.incognitoId });

      // Connect to the WebSocket stream with the DSA private key
      idLog("[4/4] Connecting WebSocket stream...");
      await globalChatStream.connect(privateKeyJwk);
      idLog("[4/4] ✔ WebSocket stream connected and authenticated");

      // Subscribe to status updates for all registered contacts
      const contacts = await db.contacts.toArray();
      idLog(`Subscribing to status updates for ${contacts.length} contact(s)`);
      for (const contact of contacts) {
        try {
          idLog(`  → SUBSCRIBE_STATUS`, { id: contact.id, codename: contact.codename });
          globalChatStream.send({
            id: crypto.randomUUID(),
            type: "command",
            to: [],
            payload: {
              code: "SUBSCRIBE_STATUS",
              message: "",
              targetId: contact.id,
            },
          });
        } catch (subErr) {
          logger.error("[IDENTITY]", `Failed to subscribe to contact ${contact.id} status`, subErr);
        }
      }

      setData({
        id: userId,
        codename: authRes.data.codename,
        incognitoId: authRes.data.incognitoId,
      });
      idLog("✔ authenticate() complete", { id: userId, codename: authRes.data.codename });
    } catch (err) {
      logger.error("[IDENTITY]", "Challenge-Response verification failed", err);
      setData(null);
    } finally {
      setIsLoading(false);
      isAuthenticating.current = false; // Release lock when complete
      idLog("authenticate() lock released");
    }
  };

  useEffect(() => {
    (async () => {
      await authenticate();
    })();
  }, []);

  return {
    data,
    isLoading,
    refetch: authenticate,
  };
};
