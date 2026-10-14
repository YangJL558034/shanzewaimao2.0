import assert from "node:assert/strict";
import { createServer } from "node:net";

let verdict = "clean";
let largestReceived = 0;
const server = createServer((socket) => {
  let incoming = Buffer.alloc(0);
  let command = "";
  let total = 0;
  socket.on("data", (chunk) => {
    incoming = Buffer.concat([incoming, chunk]);
    if (!command) {
      const boundary = incoming.indexOf(0);
      if (boundary < 0) return;
      command = incoming.subarray(0, boundary).toString();
      incoming = incoming.subarray(boundary + 1);
      if (command === "zPING") { socket.end("PONG\0"); return; }
      if (command === "zVERSIONCOMMANDS") { socket.end("ClamAV 1.0/test-db COMMANDS: PING VERSION INSTREAM\0"); return; }
      assert.equal(command, "zINSTREAM");
    }
    while (incoming.length >= 4) {
      const length = incoming.readUInt32BE(0);
      if (incoming.length < length + 4) return;
      incoming = incoming.subarray(length + 4);
      if (!length) {
        largestReceived = Math.max(largestReceived, total);
        socket.end(verdict === "infected" ? "stream: Mock.Test.Signature FOUND\0" : verdict === "error" ? "stream: scanner ERROR\0" : "stream: OK\0");
        return;
      }
      total += length;
    }
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.ANTIVIRUS_ENGINE = "clamd";
process.env.CLAMAV_HOST = "127.0.0.1";
process.env.CLAMAV_PORT = String(server.address().port);

try {
  const { getAntivirusStatus, scanBufferForViruses, scanFileForViruses } = await import("../lib/antivirus.ts");
  assert.equal((await getAntivirusStatus()).available, true);
  const clean = await scanBufferForViruses(Buffer.alloc(150000, 65), "sample.txt");
  assert.equal(clean.status, "clean");
  assert.equal(largestReceived, 150000, "INSTREAM must transmit all chunked bytes.");
  verdict = "infected";
  const infected = await scanBufferForViruses(Buffer.from("harmless mock payload"));
  assert.equal(infected.status, "infected");
  assert.equal(infected.signature, "Mock.Test.Signature");
  verdict = "error";
  assert.equal((await scanBufferForViruses(Buffer.from("harmless mock payload"))).status, "error");
  assert.equal((await scanFileForViruses("relative-file.txt")).status, "error");
  process.env.ANTIVIRUS_MAX_BYTES = "1024";
  assert.equal((await scanBufferForViruses(Buffer.alloc(2048))).status, "skipped");
  process.env.ANTIVIRUS_ENGINE = "off";
  assert.equal((await getAntivirusStatus()).available, false);
  assert.equal((await scanBufferForViruses(Buffer.from("safe"))).status, "unavailable");
  console.log("PASS: ClamD framing/chunking, clean verdict, signature detection, scanner errors, size limit, missing engine and relative-path rejection (mock transport, no malware files created).");
} finally { await new Promise((resolve) => server.close(resolve)); }
