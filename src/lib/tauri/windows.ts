import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const DISPLAY_LABEL = "display";

/**
 * Opens the TV view in its own window so the admin console stays visible on the
 * laptop while the display runs on the television. A second call focuses the
 * window that is already open.
 */
export async function openDisplayWindow() {
  const existing = await WebviewWindow.getByLabel(DISPLAY_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const display = new WebviewWindow(DISPLAY_LABEL, {
    url: "/display/",
    title: "Tournament-Companion · TV-View",
    width: 1280,
    height: 720,
    resizable: true,
  });
  await new Promise<void>((resolve, reject) => {
    display.once("tauri://created", () => resolve());
    display.once("tauri://error", (event) =>
      reject(new Error(String(event.payload))),
    );
  });
}

/** Switches the current window between fullscreen and windowed mode. */
export async function toggleFullscreen() {
  const window = getCurrentWindow();
  await window.setFullscreen(!(await window.isFullscreen()));
}
