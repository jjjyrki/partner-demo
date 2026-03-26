import forge from "node-forge";
import { getCardPublicKey, getEncryptedCVV, getEncryptedPAN } from "./client";

type EndpointType = "pan" | "cvv";

async function decryptCardSecret(endpoint: EndpointType): Promise<string> {
  const encryptionKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(encryptionKeyBytes);
  const encryptionKey = btoa(String.fromCharCode(...encryptionKeyBytes));

  const { publicKey: publicKeyPem } = await getCardPublicKey();
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(encryptionKey, "RSA-OAEP");
  const sessionId = forge.util.encode64(encrypted);

  const encryptedData = await (endpoint === "pan"
    ? getEncryptedPAN(sessionId)
    : getEncryptedCVV(sessionId));

  const iv = encryptedData?.iv;
  const secret = encryptedData?.secret;

  if (!iv || !secret) {
    throw new Error("Invalid encrypted response");
  }

  const keyBuffer = Uint8Array.from(atob(encryptionKey), (c) =>
    c.charCodeAt(0),
  );

  const ivBuffer = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const encryptedBuffer = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

  const authTag = encryptedBuffer.slice(encryptedBuffer.length - 16);
  const ciphertext = encryptedBuffer.slice(0, encryptedBuffer.length - 16);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer, tagLength: 128 },
    cryptoKey,
    ciphertextWithTag,
  );

  return new TextDecoder().decode(decrypted);
}

export async function getDecryptedPAN(): Promise<string> {
  return decryptCardSecret("pan");
}

export async function getDecryptedCVV(): Promise<string> {
  return decryptCardSecret("cvv");
}
