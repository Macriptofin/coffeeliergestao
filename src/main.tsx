import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('🚀 Main.tsx: Iniciando aplicação...');

const rootElement = document.getElementById("root");
console.log('🚀 Main.tsx: Root element encontrado?', !!rootElement);

if (rootElement) {
  createRoot(rootElement).render(<App />);
  console.log('🚀 Main.tsx: App renderizado!');
} else {
  console.error('❌ Main.tsx: Root element não encontrado!');
}
