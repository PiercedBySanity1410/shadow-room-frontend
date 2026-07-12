import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import {
  ArrowRightIcon,
  UserIcon,
} from "../../../shared/components/icons/icons";
import { db } from "../../../db/database";
import { E2EECryptoUtils } from "../../../core/crypto/e2ee-cryptosystem";
import { useStore } from "../../../core/store/useStore"; // Adjust this import path as needed
import "../styles/auth.scss";

/**
 * HardwareIdentity component automates generation and registration of decentralized
 * cryptographic key bundles. Establishes ECDH handshake pairs and ECDSA identity signers
 * lockable to the physical machine storage, routing profile responses to the store context.
 */
const HardwareIdentity = () => {
  const navigate = useNavigate();
  const isRegistering = useRef(false);

  // Connect to global Zustand store
  const { user, isLoading, setUser, setIsLoading } = useStore();

  useEffect(() => {
    if (isRegistering.current) return;
    isRegistering.current = true;

    /**
     * Internal async logic executing key registration sequentially.
     * Generates fresh cryptographic materials, maps them to JWK representation,
     * registers user profile details on the Go backend, and persists key pairs in local IndexedDB.
     */
    const autoRegister = async () => {
      try {
        // 1 & 2. Call the stateless utility to generate the complete identity bundle
        const identityBundle =
          await E2EECryptoUtils.generateIdentity("ShadowByte_99");

        /**
         * Helper utility narrowing standard JSONWebKey properties down to
         * parameters supported by Go's cryptoutil.JSONWebKeyPublic.
         *
         * @param jwk - Raw exported JSONWebKey
         * @returns Object containing type, curve, and coordinates
         */
        const filterJwk = (jwk: JsonWebKey) => ({
          kty: jwk.kty,
          crv: jwk.crv,
          x: jwk.x,
          y: jwk.y,
        });

        const backendUrl =
          import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:8080";

        // 3. Send public JWK assets to backend
        const response = await axios.post(`${backendUrl}/api/auth/register`, {
          identityPublic: filterJwk(identityBundle.ecdsaPublic),
          handshakePublic: filterJwk(identityBundle.ecdhPublic),
        });

        const profile = response.data; // Expected: { id, codename, incognitoId }

        // Update global Zustand store
        setUser(profile);

        localStorage.removeItem("user_id");
        await db.keys.clear();
        await db.contacts.clear();
        await db.messages.clear();
        await db.senderKeys.clear();

        // 4. Store standard backend metadata application session references
        localStorage.setItem("user_id", profile.id);

        // 5 & 6. Persist key pairs into Dexie using the new flat structure and naming conventions

        // Save the normal (ECDH) key pair under the standard userId
        await db.keys.put({
          id: profile.id,
          publicKey: identityBundle.ecdhPublic,
          privateKey: identityBundle.ecdhPrivate,
        });

        // Save the DSA (ECDSA) key pair under the userId:dsa format
        await db.keys.put({
          id: `${profile.id}:dsa`,
          publicKey: identityBundle.ecdsaPublic,
          privateKey: identityBundle.ecdsaPrivate,
        });
      } catch (err) {
        console.error("Auto-registration failure:", err);
        isRegistering.current = false;
        setUser({ id: "", codename: "Registration Error", incognitoId: "" });
      } finally {
        setTimeout(() => {
          setIsLoading(false);
        }, 1000); // Optional delay to prevent rapid re-registration attempts
      }
    };

    autoRegister();
  }, [navigate, setUser, setIsLoading]);

  return (
    <div className="hardware-identity">
      <div className="hardware-identity__header">
        <h1 className="hardware-identity__title">Link Hardware Identity</h1>
        <p className="hardware-identity__subtitle">
          No email or phone required. Pure anonymity.
        </p>
      </div>

      <div className="hardware-identity__avatar-container">
        {isLoading ? (
          <div className="hardware-identity__avatar-placeholder" />
        ) : (
          <img
            src={`images/${user?.incognitoId}`}
            alt="Avatar"
            className="hardware-identity__avatar"
          />
        )}
      </div>

      <div className="hardware-identity__field-group">
        <div className="hardware-identity__field-header">
          <span className="hardware-identity__label">Display Alias</span>
        </div>
        <div className="hardware-identity__input-wrapper">
          <div className="hardware-identity__input-icons">
            <UserIcon />
          </div>
          <span className="hardware-identity__value">
            {isLoading ? "Generating..." : user?.codename}
          </span>
        </div>
      </div>

      <div className="hardware-identity__action-container">
        <button
          className="hardware-identity__button"
          aria-label="Submit"
          disabled={isLoading}
          onClick={() => navigate("/")}
        >
          <ArrowRightIcon color="#111" />
        </button>
      </div>

      <p className="hardware-identity__disclaimer">
        This identity is strictly locked to this physical device. Transferring
        or cloning keys is mathematically prohibited.
      </p>
    </div>
  );
};

export default HardwareIdentity;
