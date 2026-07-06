import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest doesn't run in Jest-globals mode here, so Testing Library's automatic
// afterEach(cleanup) never registers itself — without this, DOM from one test in a file
// leaks into the next, breaking any `getByRole`/`getByLabelText` query that expects one match.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement <dialog>'s imperative API at all (not even as a stub) despite the DOM
// typings declaring it, so any test that actually opens a Drawer/ConfirmDialog — as opposed to
// just rendering one closed — needs this before `showModal`/`close` throw "not a function".
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
