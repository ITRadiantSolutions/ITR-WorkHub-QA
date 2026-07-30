import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.jsx";
import { store } from "./store/store.js";

const shouldCleanServiceWorker =
  "serviceWorker" in navigator &&
  (import.meta.env.DEV ||
    !localStorage.getItem("flowtrack-service-worker-cleaned"));

if (shouldCleanServiceWorker) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }

      if (!import.meta.env.DEV) {
        localStorage.setItem("flowtrack-service-worker-cleaned", "true");
      }

      const reloadKey = "flowtrack-sw-cleaned";
      if (
        navigator.serviceWorker.controller &&
        !sessionStorage.getItem(reloadKey)
      ) {
        sessionStorage.setItem(reloadKey, "true");
        window.location.reload();
      }
    } catch {
      // Development-only cleanup should never block the app from starting.
    }
  });
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent Chrome 67+ from automatically showing prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Optionally show install UI button here
  showInstallPromotion();
});

window.addEventListener("appinstalled", (evt) => {
  console.log("PWA was installed 🎉");
  deferredPrompt = null;
  // Hide install UI if shown
});

function showInstallPromotion() {
  // Optional: Show custom install button
  // For now, log and expose globally for manual trigger
  console.log("📱 PWA ready to install! Call window.installPWA()");
}

// Global function to trigger install
window.installPWA = () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("PWA installed ✅");
      }
      deferredPrompt = null;
    });
  } else {
    console.log("No install prompt available");
  }
};

createRoot(document.getElementById("root")).render(

    <Provider store={store}>
      <App />
    </Provider>

);
