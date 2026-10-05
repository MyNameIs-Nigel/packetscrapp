import { NAME_MAX_CODE_POINTS, NAME_MAX_RAW_UNITS } from "./protocol.ts";

export type NameRejection = "name_empty" | "name_too_long";

export type NameResult =
  { ok: true; name: string } | { ok: false; reason: NameRejection };

function isControl(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

/** Remove U+0000-001F and U+007F-009F. They are deleted, not replaced by spaces. */
function stripControls(raw: string): string {
  let result = "";
  for (const character of raw) {
    if (!isControl(character.codePointAt(0) ?? 0)) result += character;
  }
  return result;
}

/**
 * Nickname rule (E1 handoff): strip control characters, normalize to NFC,
 * trim, then require 1-16 Unicode code points. Overlength input is rejected,
 * never truncated. The result is plain text and must be rendered as text.
 */
export function sanitizeNickname(raw: string): NameResult {
  if (raw.length > NAME_MAX_RAW_UNITS) {
    return { ok: false, reason: "name_too_long" };
  }
  const name = stripControls(raw).normalize("NFC").trim();
  const length = [...name].length;
  if (length === 0) return { ok: false, reason: "name_empty" };
  if (length > NAME_MAX_CODE_POINTS) {
    return { ok: false, reason: "name_too_long" };
  }
  return { ok: true, name };
}
