// One-off recolor pass: match each module's internal UI accent to its Hub
// tile color (Hub.jsx ACCENTS: FlowTrack=blue/indigo, Timesheet=emerald/teal,
// PMS=violet/purple). Run with: node scripts/rethemeModule.mjs
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".jsx")) out.push(full);
  }
  return out;
}

function reTheme(dir, fromA, toA, fromB, toB, skipLineMarkers = []) {
  const files = walk(join(ROOT, dir));
  let changedFiles = 0;
  for (const file of files) {
    const original = readFileSync(file, "utf8");
    const lines = original.split("\n");
    const newLines = lines.map((line) => {
      if (skipLineMarkers.some((m) => line.includes(m))) return line;
      return line
        .replace(new RegExp(`\\b${fromA}-(\\d{2,3})\\b`, "g"), `${toA}-$1`)
        .replace(new RegExp(`\\b${fromB}-(\\d{2,3})\\b`, "g"), `${toB}-$1`);
    });
    const updated = newLines.join("\n");
    if (updated !== original) {
      writeFileSync(file, updated, "utf8");
      changedFiles++;
    }
  }
  console.log(`${dir}: ${changedFiles}/${files.length} files updated (${fromA}->${toA}, ${fromB}->${toB})`);
}

// Timesheet module -> emerald/teal (matches Hub's "Timesheet" tile)
reTheme("Timesheet", "blue", "emerald", "indigo", "teal", ["AVATAR_COLORS"]);

// PMS module -> violet/purple (matches Hub's "PMS" tile)
reTheme("PMS", "blue", "violet", "indigo", "purple");
