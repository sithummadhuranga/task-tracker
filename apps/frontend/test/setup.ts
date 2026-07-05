import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest doesn't run in Jest-globals mode here, so Testing Library's automatic
// afterEach(cleanup) never registers itself — without this, DOM from one test in a file
// leaks into the next, breaking any `getByRole`/`getByLabelText` query that expects one match.
afterEach(() => {
  cleanup();
});
