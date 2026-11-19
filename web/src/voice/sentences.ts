/** Splits a turn into sentences, so the first one plays while the next is still being synthesized. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+[\])'"”’]*\s*|[^.!?…]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean)
}
