import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const native = mode === "native";
  return {
    define: { __NATIVE_BUILD__: JSON.stringify(native) },
    publicDir: native ? false : "public",
    build: {
      outDir: native ? "dist-native" : "dist",
      manifest: !native,
      rolldownOptions: {
        input: {
          timeandate: resolve(import.meta.dirname, "index.html"),
          ...(!native && {
            intervalTimer: resolve(import.meta.dirname, "interval-timer-app/index.html"),
          }),
        },
      },
    },
  };
});
