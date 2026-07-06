export const TOAST_LAYER_ID = "toast-layer";

// A native <dialog> opened via showModal() enters the browser's top layer, which renders above
// everything else in the document regardless of z-index — including Sonner's toast container,
// which is just a very-high-z-index element, not a top-layer one. Without this, any toast fired
// while a Drawer or ConfirmDialog is open is invisible behind it.
//
// The fix is the Popover API: an element with popover="manual" can also enter the top layer, and
// top-layer elements stack by most-recently-shown, not z-index. Re-showing this element right
// after a dialog opens moves it above that dialog. hidePopover() first is required — showPopover()
// on an already-open popover throws.
export function promoteToastLayer(): void {
  const layer = document.getElementById(TOAST_LAYER_ID);
  if (!layer || !("showPopover" in layer)) {
    return;
  }
  if (layer.matches(":popover-open")) {
    layer.hidePopover();
  }
  layer.showPopover();
}
