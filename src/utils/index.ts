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
