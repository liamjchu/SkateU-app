import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const renderedRoots: Array<{ container: HTMLDivElement; root: Root }> = [];

export function render(ui: ReactNode): HTMLDivElement {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => root.render(ui));
  renderedRoots.push({ container, root });
  return container;
}

export function cleanup(): void {
  for (const { container, root } of renderedRoots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
}

export function change(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (!setValue) {
    throw new Error("Input value setter is unavailable.");
  }

  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function submit(form: HTMLFormElement): void {
  act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

export async function waitFor(assertion: () => void): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
