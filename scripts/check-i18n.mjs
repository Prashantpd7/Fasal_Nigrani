import { readFileSync } from "fs";
import { execSync } from "child_process";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const en = read("locales/en.json");
const hi = read("locales/hi.json");

function flat(o, prefix = "") {
  let out = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out = { ...out, ...flat(v, key) };
    } else {
      out[key] = v;
    }
  }
  return out;
}
const E = flat(en);
const H = flat(hi);

const reportMissing = (src, dst, label) => {
  const m = Object.keys(src).filter((k) => !(k in dst));
  if (m.length) console.log(`MISSING in ${label}: ${m.join(", ")}`);
};
reportMissing(E, H, "hi");
reportMissing(H, E, "en");

const params = (s) =>
  typeof s !== "string"
    ? []
    : [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
for (const [k, v] of Object.entries(E)) {
  const p = params(v);
  const q = params(H[k] ?? "");
  if (p.join() !== q.join()) console.log(`PARAM MISMATCH ${k}: en[${p}] hi[${q}]`);
}

// Keys referenced from code (static literal keys).
const files = execSync(
  `grep -rlE "t\\(|tLang\\(" app components lib --include="*.ts" --include="*.tsx"`,
  { shell: "/bin/bash" }
)
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean);
const code = files.map((f) => readFileSync(f, "utf8")).join("\n");
const used = new Set();
for (const m of code.matchAll(/t\(\s*["']([\w.-]+)["']/g)) used.add(m[1]);
for (const m of code.matchAll(/tLang\(\s*["']([\w.-]+)["']/g)) used.add(m[1]);
const missingInEn = [...used].filter((k) => !(k in E));
console.log(
  "static keys used but missing:",
  missingInEn.length ? missingInEn.join(", ") : "NONE"
);

console.log("flat keys en:", Object.keys(E).length, "hi:", Object.keys(H).length);
