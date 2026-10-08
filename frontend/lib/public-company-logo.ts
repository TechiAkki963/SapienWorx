import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export function isPublicLogoAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Restrict IPv6 to ordinary global unicast; reject local/mapped, transition,
  // documentation and special-purpose ranges rather than decoding embedded IPs.
  return isIP(address) === 6 && /^[23]/i.test(address) && !/^200[12]:/i.test(address);
}

export function publicLogoURL(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || /\.(localhost|local|internal)$/i.test(host)) return null;
    if (isIP(host) && !isPublicLogoAddress(host)) return null;
    return url;
  } catch { return null; }
}

// Company branding URLs are user-supplied. Pin the socket to a verified public
// DNS result, never follow redirects, and bound time/bytes before embedding.
// A missing, inaccessible or unsupported logo falls back to company initials.
function boundedImage(bytes: Buffer, type: string): boolean {
  let width = 0, height = 0;
  if (type === "image/png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 255) return false;
      const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) return false;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        if (length < 8) return false;
        height = bytes.readUInt16BE(offset + 5); width = bytes.readUInt16BE(offset + 7); break;
      }
      offset += 2 + length;
    }
  }
  return width > 0 && height > 0 && width <= 4096 && height <= 4096 && width * height <= 4_000_000;
}

export async function loadPublicCompanyLogo(raw?: string, network = { lookup, request }): Promise<string | null> {
  if (!raw) return null;
  const url = publicLogoURL(raw);
  if (!url) return null;
  const deadline = Date.now() + 2500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answers = await Promise.race([
      network.lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("logo DNS timeout")), 1000); }),
    ]);
    if (!answers.length || answers.some(answer => !isPublicLogoAddress(answer.address))) return null;
    const answer = answers[0];
    return await new Promise<string | null>((resolve) => {
      const req = network.request(url, {
        method: "GET", family: answer.family,
        lookup: (_host, _options, callback) => callback(null, answer.address, answer.family),
        headers: { Accept: "image/png,image/jpeg", "User-Agent": "SapienWorx-JobCard/1.0" },
      }, response => {
        const type = response.headers["content-type"]?.split(";")[0].trim();
        if (response.statusCode !== 200 || !["image/png", "image/jpeg"].includes(type || "")) {
          response.destroy(); resolve(null); return;
        }
        const parts: Buffer[] = []; let length = 0;
        response.on("data", (part: Buffer) => {
          length += part.length;
          if (length > 256 * 1024) { response.destroy(); resolve(null); }
          else parts.push(part);
        });
        response.on("error", () => resolve(null));
        response.on("end", () => {
          const bytes = Buffer.concat(parts);
          resolve(boundedImage(bytes, type || "") ? `data:${type};base64,${bytes.toString("base64")}` : null);
        });
      });
      // A hard total deadline also terminates servers that trickle bytes.
      const stop = setTimeout(() => { req.destroy(); resolve(null); }, Math.max(1, deadline - Date.now()));
      req.on("error", () => resolve(null));
      req.on("close", () => clearTimeout(stop));
      req.end();
    });
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}
