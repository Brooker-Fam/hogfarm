import { randomBytes } from "node:crypto";
import { slugExists } from "@/lib/db";

function baseSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "farm"
  );
}

export async function uniqueSlug(name: string): Promise<string> {
  const base = baseSlug(name);
  if (!(await slugExists(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(2).toString("hex")}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}
