import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Toda rota é carregada sob demanda (lazy/code-splitting) em pedaços com nome
// versionado. Depois de um novo deploy, uma aba já aberta que tenta navegar
// pra uma rota ainda não carregada busca um pedaço que não existe mais no ar
// — cai na tela de erro genérica sem nenhuma ação clara pro usuário. Recarregar
// a página resolve (busca o pacote atual do zero), então fazemos isso
// automaticamente em vez de travar o usuário. Guarda de sessão evita loop
// infinito se o recarregamento não resolver por outro motivo.
function handleStaleChunk() {
  const key = "stale-chunk-reload-at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last < 15_000) return; // já tentou recentemente, não repete
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
}

window.addEventListener("vite:preloadError", handleStaleChunk);

window.addEventListener("unhandledrejection", (event) => {
  const message = String(event?.reason?.message || event?.reason || "");
  if (/failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message)) {
    handleStaleChunk();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
