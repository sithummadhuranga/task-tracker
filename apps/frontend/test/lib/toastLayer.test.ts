import { afterEach, describe, expect, it, vi } from "vitest";
import { TOAST_LAYER_ID, promoteToastLayer } from "../../src/lib/toastLayer";

// jsdom doesn't implement the Popover API, so showPopover/hidePopover/:popover-open are stubbed
// directly onto the element rather than relying on real browser behavior — this test is about
// promoteToastLayer's own branching (missing element, unsupported API, already-open vs. not),
// not about the Popover API itself. The mocks are returned alongside the element (rather than
// read back off it) to avoid eslint's unbound-method warning on DOM method references.
function appendStubLayer(isOpen: boolean) {
  const showPopover = vi.fn();
  const hidePopover = vi.fn();
  const matches = vi.fn(() => isOpen) as unknown as Element["matches"];

  const layer = document.createElement("div");
  layer.id = TOAST_LAYER_ID;
  Object.assign(layer, { showPopover, hidePopover, matches });
  document.body.appendChild(layer);

  return { showPopover, hidePopover };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("promoteToastLayer", () => {
  it("does nothing if the toast layer element isn't in the DOM", () => {
    expect(() => {
      promoteToastLayer();
    }).not.toThrow();
  });

  it("does nothing if the element doesn't support the Popover API", () => {
    const layer = document.createElement("div");
    layer.id = TOAST_LAYER_ID;
    document.body.appendChild(layer);

    expect(() => {
      promoteToastLayer();
    }).not.toThrow();
  });

  it("shows the layer directly when it isn't currently open", () => {
    const { showPopover, hidePopover } = appendStubLayer(false);

    promoteToastLayer();

    expect(hidePopover).not.toHaveBeenCalled();
    expect(showPopover).toHaveBeenCalledTimes(1);
  });

  it("hides then re-shows the layer when it's already open, to re-promote it to the top", () => {
    const { showPopover, hidePopover } = appendStubLayer(true);

    promoteToastLayer();

    expect(hidePopover).toHaveBeenCalledTimes(1);
    expect(showPopover).toHaveBeenCalledTimes(1);
  });
});
