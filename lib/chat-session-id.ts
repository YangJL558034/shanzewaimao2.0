/** A UUID v4 also works on phones opening the development site over LAN HTTP.
 * randomUUID needs a secure context; getRandomValues does not.
 * This identifies a conversation, never replaces its server-issued access token.
 */
export function createChatSessionId(source: Crypto = globalThis.crypto): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  if (typeof source?.getRandomValues !== "function") {
    throw new Error("Your browser cannot start a secure chat. Please use an up-to-date browser.");
  }
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
