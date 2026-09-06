/**
 * A stable, readable colour for a player. Bright enough to carry dark text,
 * which is how avatars and chips are drawn.
 */
export const stringToColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  // Nudge away from the muddy yellow-green band so names stay distinguishable.
  const saturation = 62 + (Math.abs(hash >> 8) % 20);
  const lightness = 62 + (Math.abs(hash >> 16) % 12);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/** Six-character room codes, easy to read out loud. */
export const randomRoomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

/** What `shareOrCopy` managed to do, so a caller can label its button. */
export type ShareOutcome = "shared" | "copied" | "failed";

/**
 * Hand something to the OS share sheet where there is one, and fall back to
 * the clipboard everywhere else. On a phone the share sheet is how a daily
 * result or a room invite actually reaches a chat app; on a desktop browser
 * `navigator.share` is usually absent, and the clipboard is the right answer.
 *
 * Dismissing the sheet counts as shared: the user made a choice, and dropping
 * the text into their clipboard behind their back is not a helpful fallback.
 */
export const shareOrCopy = async (data: ShareData): Promise<ShareOutcome> => {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    if (!navigator.canShare || navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "shared";
        // Anything else (a permission policy, a missing handler) falls through
        // to the clipboard below.
      }
    }
  }

  const text = [data.text, data.url].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
};

/**
 * Hand a blob to the browser as a file download. The anchor has to be in the
 * document for Firefox to honour the click, and the object URL is released
 * straight after — the download has already taken its own reference.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
