// Only loaded by the isolated support regression test, never by application code.
if (!globalThis.__supportCheck) throw new Error("Isolated support services were not initialized.");
module.exports = globalThis.__supportCheck;
