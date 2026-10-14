// Used only by check-image-upload.ts, never imported by application code.
if (!globalThis.__imageUploadCheck) throw new Error("Isolated upload test services were not initialized.");
module.exports = globalThis.__imageUploadCheck;
