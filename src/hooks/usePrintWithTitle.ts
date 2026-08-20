import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

type PrintOptions = Parameters<typeof useReactToPrint>[0];

// Safari usa o título da PÁGINA PRINCIPAL no diálogo "Salvar como PDF",
// ignorando o documentTitle que o react-to-print põe no iframe de impressão —
// confirmado ao vivo em 20/ago/2026 (sugeria "Coffeelier - Sistema de Gestão"
// pra qualquer impressão). Este wrapper troca document.title no instante do
// print e restaura depois; no Chrome (que usa o do iframe) é inócuo.
// Use SEMPRE este hook no lugar de useReactToPrint direto.
export function usePrintWithTitle(options: PrintOptions) {
  const prevTitle = useRef('');
  return useReactToPrint({
    ...options,
    onBeforePrint: async () => {
      // O onBeforePrint do chamador roda primeiro (pode abortar via reject —
      // ex.: InventarioCiclo sem materiais); só então trocamos o título.
      await options.onBeforePrint?.();
      prevTitle.current = document.title;
      if (typeof options.documentTitle === 'string' && options.documentTitle) {
        document.title = options.documentTitle;
      }
    },
    onAfterPrint: () => {
      if (prevTitle.current) document.title = prevTitle.current;
      options.onAfterPrint?.();
    },
  });
}
