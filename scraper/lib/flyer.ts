export function extractPublicationIdFromImage(url?: string | null) {
  if (!url) return null;
  try {
    const tail = url.split("/").pop();
    if (!tail) return null;
    const [encoded] = tail.split(".");
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    return decoded.replace(/[^a-z0-9/_-]+/gi, "-").toLowerCase();
  } catch {
    return null;
  }
}
