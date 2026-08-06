const IV_BYTES = 12;

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const packed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), IV_BYTES);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptSecret(packedBase64: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const packed = Uint8Array.from(atob(packedBase64), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, IV_BYTES) },
    key,
    packed.slice(IV_BYTES)
  );
  return new TextDecoder().decode(plaintext);
}
