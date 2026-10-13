// Icon paths copied from the supplied design (docs/purchase-approval.html).
const PATHS = {
  check: "m5 12 4 4L19 6",
  building:
    "M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3",
  inbox: "M4 4h16v16H4zM4 14h5l2 3h2l2-3h5M8 8h8M8 11h5",
  logout: "M9 4H4v16h5m6-13 5 5-5 5M8 12h12",
  alert: "m12 3 10 18H2zM12 9v5M12 17v.1",
  arrowRight: "M4 12h16m-6-6 6 6-6 6",
  file: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
