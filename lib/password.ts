import {
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_LENGTH = 12;
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function deriveKey(
  plain: string,
  salt: Buffer,
  cost: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      plain,
      salt,
      KEY_LENGTH,
      {
        N: cost,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveKey(plain, salt, SCRYPT_N);

  return `scrypt$${SCRYPT_N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, costText, saltText, hashText, ...extra] = stored.split("$");
  const cost = Number(costText);

  if (
    algorithm !== "scrypt" ||
    extra.length > 0 ||
    cost !== SCRYPT_N ||
    !saltText ||
    !hashText
  ) {
    return false;
  }

  const salt = Buffer.from(saltText, "base64");
  const expectedHash = Buffer.from(hashText, "base64");
  if (salt.length !== SALT_LENGTH || expectedHash.length !== KEY_LENGTH) {
    return false;
  }

  try {
    const actualHash = await deriveKey(plain, salt, cost);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export function generatePassword(): string {
  return Array.from(
    { length: PASSWORD_LENGTH },
    () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)],
  ).join("");
}
