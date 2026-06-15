import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InventoryAdjustment {
  id: string;
  material_id: string;
  system_quantity: number;
  physical_quantity?: number;
  material_name: string;
  material_code?: string;
  material_category: string;
  material_unit: string;
}

interface InventoryCycle {
  id: string;
  name: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface Props {
  cycle: InventoryCycle | null;
  adjustments: InventoryAdjustment[];
}

/**
 * Layout de impressão do inventário físico.
 * Usado via react-to-print — não renderiza visualmente na tela.
 */
export const InventarioPrintLayout = forwardRef<HTMLDivElement, Props>(
  ({ cycle, adjustments }, ref) => {
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Agrupar por categoria
    const grouped = adjustments.reduce<Record<string, InventoryAdjustment[]>>(
      (acc, adj) => {
        const cat = adj.material_category || "Sem categoria";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(adj);
        return acc;
      },
      {}
    );

    const categorias = Object.entries(grouped).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );

    return (
      <div ref={ref} style={styles.page}>
        {/* ── Estilos de impressão injetados ───────────────────────────── */}
        <style>{`
          @page {
            size: A4 portrait;
            margin: 14mm 12mm 14mm 12mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        {/* ── Cabeçalho ────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerTitle}>☕ Coffeelier — Inventário Físico</div>
            <div style={styles.headerSub}>
              Preencha a coluna <strong>Qtd. Física</strong> com a quantidade
              encontrada no local. Não altere os demais campos.
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.cycleName}>{cycle?.name ?? "—"}</div>
            <div style={styles.headerMeta}>Emitido em: {now}</div>
            <div style={styles.headerMeta}>
              Total de itens: <strong>{adjustments.length}</strong>
            </div>
            {cycle?.notes && (
              <div style={styles.headerMeta}>Obs: {cycle.notes}</div>
            )}
          </div>
        </div>

        {/* ── Tabela ───────────────────────────────────────────────────── */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 60 }}>Código</th>
              <th style={styles.th}>Descrição do Material</th>
              <th style={{ ...styles.th, width: 42, textAlign: "center" }}>Un.</th>
              <th style={{ ...styles.th, width: 88, textAlign: "right" }}>
                Qtd. Sistema
              </th>
              <th style={{ ...styles.thWrite, width: 88 }}>Qtd. Física</th>
              <th style={{ ...styles.thWrite, width: 100 }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map(([categoria, itens]) => (
              <>
                {/* Linha de categoria */}
                <tr key={`cat-${categoria}`}>
                  <td colSpan={6} style={styles.categoryRow}>
                    {categoria.toUpperCase()}
                  </td>
                </tr>

                {/* Itens da categoria */}
                {itens.map((adj, i) => (
                  <tr
                    key={adj.id}
                    style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}
                  >
                    <td style={styles.td}>{adj.material_code ?? "—"}</td>
                    <td style={styles.td}>{adj.material_name}</td>
                    <td style={{ ...styles.td, textAlign: "center" }}>
                      {adj.material_unit}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      {adj.system_quantity.toFixed(3)}
                    </td>
                    {/* Campo para anotação manual */}
                    <td style={styles.writeCell} />
                    <td style={styles.writeCell} />
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>

        {/* ── Rodapé com assinaturas ───────────────────────────────────── */}
        <div style={styles.footer}>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigLabel}>Responsável pela contagem</div>
          </div>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigLabel}>Data da contagem: ____/____/________</div>
          </div>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigLabel}>Conferido por</div>
          </div>
        </div>
      </div>
    );
  }
);

InventarioPrintLayout.displayName = "InventarioPrintLayout";

// ─── Estilos inline (necessário para react-to-print) ─────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 11,
    color: "#111",
    background: "#fff",
    padding: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #333",
    paddingBottom: 10,
    marginBottom: 14,
    gap: 16,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 9,
    color: "#555",
    maxWidth: 340,
    lineHeight: 1.4,
  },
  headerRight: {
    textAlign: "right",
    flexShrink: 0,
  },
  cycleName: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: "#555",
    marginTop: 2,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 28,
  },
  th: {
    background: "#222",
    color: "#fff",
    padding: "5px 7px",
    fontSize: 9,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    fontWeight: "bold",
  } as React.CSSProperties,
  thWrite: {
    background: "#444",
    color: "#fff",
    padding: "5px 7px",
    fontSize: 9,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    fontWeight: "bold",
  } as React.CSSProperties,
  td: {
    padding: "5px 7px",
    borderBottom: "1px solid #ddd",
    verticalAlign: "middle",
    fontSize: 10,
  },
  rowEven: { background: "#f7f7f7" },
  rowOdd: { background: "#fff" },
  categoryRow: {
    background: "#e8e8e8",
    padding: "4px 7px",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: "0.5px",
    color: "#333",
    textTransform: "uppercase",
    borderBottom: "1px solid #ccc",
  } as React.CSSProperties,
  writeCell: {
    border: "1px solid #aaa",
    height: 24,
    minWidth: 80,
    background: "#fff",
    padding: 0,
  },
  footer: {
    marginTop: 36,
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
  },
  sigBox: {
    flex: 1,
    textAlign: "center",
  },
  sigLine: {
    borderTop: "1px solid #333",
    marginBottom: 4,
    marginLeft: 8,
    marginRight: 8,
  },
  sigLabel: {
    fontSize: 9,
    color: "#555",
  },
};
