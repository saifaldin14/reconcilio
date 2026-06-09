// Renders walkthrough.html to a sequence of PNG frames using headless Chrome,
// then prints the frame count. ffmpeg (run separately) encodes them to MP4.
//
// Run from a temp dir that has `puppeteer-core` installed, pointing at the
// system Chrome. Usage: node render.js <htmlPath> <outDir> <chromePath>
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";

const [, , htmlPath, outDir, chromePath] = process.argv;
const FPS = 30;

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });

const duration = await page.evaluate(() => window.__duration);
const total = Math.round(duration * FPS);

for (let f = 0; f < total; f++) {
  const t = f / FPS;
  await page.evaluate((tt) => window.__seek(tt), t);
  const name = String(f).padStart(4, "0");
  await page.screenshot({ path: `${outDir}/frame_${name}.png` });
}

await browser.close();
console.log(`captured ${total} frames @ ${FPS}fps (${duration}s)`);
