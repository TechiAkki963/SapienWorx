import { readFile } from "node:fs/promises";
import path from "node:path";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> | undefined;
export function jobSocialFonts() {
  // Public assets are copied into the existing standalone Docker image.
  // Read once per process; card rendering never calls an external font service.
  fonts ??= Promise.all(([400, 700] as const).map(async weight => {
    const data = await readFile(path.join(process.cwd(), "public/fonts/job-card", weight === 700 ? "NotoSans-Bold.ttf" : "NotoSans-Regular.ttf"));
    return { name: "Noto Sans", data: new Uint8Array(data).buffer, weight, style: "normal" as const };
  }));
  return fonts;
}
