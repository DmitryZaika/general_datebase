import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AES_KEY } from "~/utils/constants";

function pack(iv: Buffer<ArrayBufferLike>, tag: Buffer<ArrayBufferLike>, ciphertext: Buffer<ArrayBuffer>) {
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function unpack(b64: string) {
  const buf = Buffer.from(b64, 'base64');
  return {
    iv:  buf.subarray(0, 12),
    tag: buf.subarray(12, 28),
    ct:  buf.subarray(28),
  };
}

export function encrypt(text: string): string {
  const iv     = randomBytes(12);                        // 96‑битовый nonce
  const cipher = createCipheriv('aes-256-gcm', AES_KEY, iv);

  const ct  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return pack(iv, tag, ct);                              // base64 ⇒ БД
}

export function decrypt(blob: string): string {
  const { iv, tag, ct } = unpack(blob);

  const decipher = createDecipheriv('aes-256-gcm', AES_KEY, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
