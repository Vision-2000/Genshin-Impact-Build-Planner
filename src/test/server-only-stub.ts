// Stands in for the real "server-only" package under Vitest. Next.js aliases
// that package to a no-op during its own server build; outside Next's build
// pipeline it throws unconditionally, so tests need this instead.
export {};
