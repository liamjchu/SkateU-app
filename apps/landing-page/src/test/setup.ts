const memory = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key) {
    return memory.get(key) ?? null;
  },
  key(index) {
    return [...memory.keys()][index] ?? null;
  },
  removeItem(key) {
    memory.delete(key);
  },
  setItem(key, value) {
    memory.set(key, value);
  },
};

function installLocalStorage(target: typeof globalThis | Window) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
}

installLocalStorage(globalThis);

if (typeof window !== "undefined") {
  installLocalStorage(window);
}
