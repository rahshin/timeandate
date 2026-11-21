import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const timerDev = mode === "timer-dev";
  const native = mode === "native" || timerDev;
  return {
    define: { __NATIVE_BUILD__: JSON.stringify(native) },
    plugins: native ? [{
      name: "dashboard-only-header",
      transformIndexHtml(html) {
        return html
          .replace(/^[ \t]*<nav aria-label="Apps">[\s\S]*?<\/nav>\r?\n/m, "")
          .replace('class="shell masthead"', 'class="shell masthead masthead-native"');
      },
    }] : [],
    publicDir: native ? false : "public",
    build: {
      outDir: timerDev ? "artifacts/timer-dev/web" : native ? "dist-native" : "dist",
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
