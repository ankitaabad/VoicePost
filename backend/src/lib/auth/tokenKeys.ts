import type { KeyObject } from "node:crypto";
import { V4 } from "paseto";

export interface PasetoKeys {
  secretKey: KeyObject;
  publicKey: KeyObject;
}

export async function getPasetoKeys(): Promise<PasetoKeys> {
  const privateKeyBase64 = process.env.PASETO_PRIVATE_KEY;
  const publicKeyBase64 = process.env.PASETO_PUBLIC_KEY;

  if (!privateKeyBase64 || !publicKeyBase64) {
    throw new Error("PASETO_PRIVATE_KEY and PASETO_PUBLIC_KEY must be set");
  }

  const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");
  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");

  const secretKey = V4.bytesToKeyObject(privateKeyBytes);
  const publicKey = V4.bytesToKeyObject(publicKeyBytes);

  return { secretKey, publicKey };
}
