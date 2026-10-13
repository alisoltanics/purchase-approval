export function demoPassword(): string {
  const value = process.env.E2E_DEMO_PASSWORD;
  if (!value) {
    throw new Error(
      "E2E_DEMO_PASSWORD is not set. Export the demo password (the value used as SEED_DEMO_PASSWORD when the stack was seeded) before running the suite.",
    );
  }
  return value;
}

export function baseUrl(): string {
  const value = process.env.E2E_BASE_URL;
  if (!value) {
    throw new Error("E2E_BASE_URL is not set (for example http://app:8000).");
  }
  return value;
}
