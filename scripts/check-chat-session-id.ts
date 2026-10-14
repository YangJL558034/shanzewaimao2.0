import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { z } from "zod";
import { createChatSessionId } from "../lib/chat-session-id";

const nativeId = "0c56816e-797a-4b1c-b84b-c608f1a1af41";
assert.equal(createChatSessionId({ randomUUID: () => nativeId } as unknown as Crypto), nativeId);
// LAN HTTP exposes getRandomValues, but not randomUUID.
const lanCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } as unknown as Crypto;
const ids = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const id = createChatSessionId(lanCrypto);
  assert.ok(z.string().uuid().safeParse(id).success, "Must pass the chat API UUID validator");
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  ids.add(id);
}
assert.equal(ids.size, 1000);
assert.throws(() => createChatSessionId({} as Crypto), /cannot start a secure chat/);
console.log("PASS: HTTPS/native and LAN HTTP/mobile session IDs, UUID validation, 1000 unique values, no insecure random fallback.");
