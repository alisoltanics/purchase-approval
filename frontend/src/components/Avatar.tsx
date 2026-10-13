import styles from "../styles/avatar.module.css";

// The design gives each person one of these soft colour pairs. Real ids are not names, so the
// pair is derived from the id and stays the same for the same person.
const TONES = [
  styles.toneViolet,
  styles.toneTan,
  styles.toneGreen,
  styles.toneBlue,
  styles.tonePink,
  styles.toneOlive,
  styles.toneSand,
] as const;

export function initials(name: string): string {
  return Array.from(
    name.split(/\s+/).filter(Boolean),
    (word) => Array.from(word)[0] ?? "",
  )
    .join("")
    .slice(0, 2);
}

function toneFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 7919;
  return TONES[hash % TONES.length] ?? "";
}

// Decorative: the name is always written next to it.
export function Avatar({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  return (
    <span className={`${styles.avatar} ${toneFor(id)} ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
