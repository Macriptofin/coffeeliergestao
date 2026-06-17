import { forwardRef } from 'react';

interface ThermalMeta {
  label: string;
  value: string;
}

interface ThermalItem {
  qty: string | number;
  unit?: string;
  name: string;
  note?: string;
}

interface ThermalPrintableOrderProps {
  kind: 'producao' | 'evento';
  orderCode: string;
  meta?: ThermalMeta[];
  items: ThermalItem[];
  footerNote?: string;
}

export const ThermalPrintableOrder = forwardRef<HTMLDivElement, ThermalPrintableOrderProps>(
  ({ kind, orderCode, meta = [], items, footerNote }, ref) => {
    const title = kind === 'producao' ? 'ORDEM DE PRODUÇÃO' : 'ORDEM DE EVENTO';

    return (
      <div
        ref={ref}
        style={{
          width: '72mm',
          margin: '0 auto',
          padding: '2mm',
          fontFamily: 'monospace',
          fontSize: '12px',
          fontWeight: 700, // impressão toda em negrito p/ melhor leitura na térmica
          color: '#000',
          background: '#fff',
          boxSizing: 'border-box',
        }}
      >
        {/* TITLE */}
        <div
          style={{
            fontWeight: 900,
            fontSize: '19px',
            textTransform: 'uppercase',
            textAlign: 'center',
            letterSpacing: '1px',
            borderTop: '3px solid #000',
            borderBottom: '3px solid #000',
            padding: '6px 0',
            marginBottom: '6px',
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>

        {/* ORDER CODE */}
        <div
          style={{
            fontWeight: 700,
            textAlign: 'center',
            fontSize: '13px',
            marginBottom: '6px',
            wordBreak: 'break-word',
          }}
        >
          {orderCode}
        </div>

        {/* META */}
        {meta.length > 0 && (
          <div style={{ marginBottom: '6px', fontSize: '11px', lineHeight: 1.5 }}>
            {meta.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>{m.label}:</span>
                <span style={{ flex: 1, wordBreak: 'break-word' }}>{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* SEPARATOR BEFORE ITEMS */}
        <div
          style={{
            borderBottom: '1px dashed #000',
            marginBottom: '6px',
          }}
        />

        {/* ITEMS */}
        <div>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                paddingBottom: '6px',
                marginBottom: '6px',
                borderBottom:
                  i < items.length - 1 ? '1px dotted #000' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                  {item.qty}
                  {item.unit ? ` ${item.unit}` : ''}
                </span>
                <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {item.name}
                </span>
              </div>
              {item.note && (
                <div style={{ fontSize: '10px', marginTop: '2px', paddingLeft: '2px' }}>
                  {item.note}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FOOTER NOTE */}
        {footerNote && (
          <div
            style={{
              borderTop: '1px dashed #000',
              marginTop: '6px',
              paddingTop: '6px',
              fontSize: '10px',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {footerNote}
          </div>
        )}
      </div>
    );
  }
);

ThermalPrintableOrder.displayName = 'ThermalPrintableOrder';
