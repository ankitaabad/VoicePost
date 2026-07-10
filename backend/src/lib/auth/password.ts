import { hash, verify } from "@node-rs/argon2";
import { sha1 } from "@oslojs/crypto/sha1";
import { encodeHexLowerCase } from "@oslojs/encoding";

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 2,
    outputLen: 32,
  });
}

export async function verifyPasswordHash(
  hash: string,
  password: string,
): Promise<boolean> {
  return await verify(hash, password);
}

export async function verifyPasswordStrength(
  password: string,
): Promise<boolean> {
  if (password.length < 8 || password.length > 255) return false;

  const hash = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
  const hashPrefix = hash.slice(0, 5);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${hashPrefix}`,
    );
    const data = await response.text();
    const items = data.split("\n");

    for (const item of items) {
      const [suffix] = item.split(":");
      if (hash.slice(5) === suffix.toLowerCase()) {
        return false;
      }
    }
  } catch (e) {
    console.warn("Could not check pwned passwords:", e);
  }

  return true;
}
