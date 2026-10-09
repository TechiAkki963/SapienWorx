import { expect, test } from "@playwright/test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { request } from "node:https";
import type { lookup } from "node:dns/promises";
import type { RequestOptions } from "node:https";
import { loadPublicCompanyLogo } from "../../lib/public-company-logo";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=", "base64");

function fixture({ status = 200, type = "image/png", bytes = png, addresses = ["8.8.8.8"] } = {}) {
  const calls: { url: URL; options: RequestOptions }[] = [];
  const network = {
    lookup: (async () => addresses.map(address => ({ address, family: 4 }))) as unknown as typeof lookup,
    request: ((url: URL, options: RequestOptions, callback: (response: Readable) => void) => {
      calls.push({ url, options });
      const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
      const response = Object.assign(Readable.from([bytes]), { statusCode: status, headers: { "content-type": type } });
      req.end = () => { response.once("close", () => req.emit("close")); callback(response); };
      req.destroy = () => { response.destroy(); req.emit("close"); };
      return req;
    }) as unknown as typeof request,
  };
  return { network, calls };
}

test("a public PNG logo is embedded while DNS resolution is pinned to its verified address", async () => {
  const f = fixture();
  expect(await loadPublicCompanyLogo("https://cdn.example.test/logo.png", f.network)).toBe("data:image/png;base64," + png.toString("base64"));
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0].url.hostname).toBe("cdn.example.test");
  const pinned = await new Promise(resolve => f.calls[0].options.lookup!("cdn.example.test", {}, (_error, address, family) => resolve({ address, family })));
  expect(pinned).toEqual({ address: "8.8.8.8", family: 4 });
});

test("mixed public/private DNS answers fail closed before any connection", async () => {
  const f = fixture({ addresses: ["8.8.8.8", "10.0.0.1"] });
  expect(await loadPublicCompanyLogo("https://cdn.example.test/logo.png", f.network)).toBeNull();
  expect(f.calls).toHaveLength(0);
});

test("redirects, unsupported formats, oversized files and decompression-bomb dimensions fall back", async () => {
  const bomb = Buffer.from(png); bomb.writeUInt32BE(100000, 16); bomb.writeUInt32BE(100000, 20);
  for (const options of [{ status: 302 }, { type: "image/svg+xml" }, { bytes: Buffer.alloc(256*1024+1) }, { bytes: bomb }, { bytes: Buffer.from("not a PNG") }]) {
    const f = fixture(options);
    expect(await loadPublicCompanyLogo("https://cdn.example.test/logo.png", f.network)).toBeNull();
    expect(f.calls).toHaveLength(1);
  }
});
