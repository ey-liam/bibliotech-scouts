import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";

const root = process.cwd();
const checkOnly = process.argv.includes("--check");

const JOBS = [
  {
    src: path.join(root, "src", "styles.css"),
    out: path.join(root, "styles.css"),
    loader: "css",
    banner: "/* BiblioTech Scout CSS (8.4.1) - generado desde src/styles.css */\n",
  },
  {
    src: path.join(root, "src", "app.js"),
    out: path.join(root, "app.js"),
    loader: "js",
    banner: "// BiblioTech Scout JS (8.4.1) - generado desde src/app.js\n",
  },
];

let changedOrOutdated = false;

for (const job of JOBS) {
  const raw = await readFile(job.src, "utf8");
  const result = await esbuild.transform(raw, {
    loader: job.loader,
    minify: true,
    charset: "utf8",
    legalComments: "none",
    ...(job.loader === "css" ? { target: ["safari14", "chrome90", "firefox90"] } : {}),
  });

  const compiled = (job.banner + result.code).replace(/\r\n/g, "\n");
  if (Buffer.byteLength(compiled, "utf8") < 10240) {
    throw new Error(`Salida inesperadamente pequeña en ${path.basename(job.out)} (< 10 KB)`);
  }

  let current = "";
  try {
    current = (await readFile(job.out, "utf8")).replace(/\r\n/g, "\n");
  } catch (_) {}

  const srcKb = (Buffer.byteLength(raw, "utf8") / 1024).toFixed(1);
  const outKb = (Buffer.byteLength(compiled, "utf8") / 1024).toFixed(1);

  if (checkOnly) {
    if (current !== compiled) {
      console.error(`DESINCRONIZADO: ${path.basename(job.out)} no coincide con src/${path.basename(job.src)}. Ejecuta "npm run build".`);
      changedOrOutdated = true;
    } else {
      console.log(`OK ${path.basename(job.out)}: ${srcKb} KB -> ${outKb} KB (minificado y al día)`);
    }
  } else {
    await writeFile(job.out, compiled, "utf8");
    console.log(`Generado ${path.basename(job.out)}: ${srcKb} KB -> ${outKb} KB`);
  }
}

if (checkOnly && changedOrOutdated) {
  process.exit(1);
}
