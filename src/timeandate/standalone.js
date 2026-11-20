import "../style.css";
import { mountMultiTimer } from "./view.js";

mountMultiTimer(document.querySelector("#app"), { standalone: true });

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/interval-timer-app/sw.js").catch(() => {
    // Installation and offline support are optional. The online timer still works.
  });
}
