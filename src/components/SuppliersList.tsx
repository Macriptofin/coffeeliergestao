import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Clock, Eye, MapPin, Pencil, Trash2 } from "lucide-react";
import { Supplier } from "./SupplierForm";

interface SuppliersListProps {
  suppliers: Supplier[];
  ytdSpend: Record<string, number>;
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplierId: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Alimentos & Ingredientes':       { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  'Bebidas & Bar':                  { bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-400' },
  'Embalagens & Descartáveis':      { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400' },
  'Higiene & Limpeza':              { bg: 'bg-cyan-100 dark:bg-cyan-900/30',        text: 'text-cyan-700 dark:text-cyan-400' },
  'Equipamentos & Utensílios':      { bg: 'bg-amber-100 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-400' },
  'Serviços de Transporte / Frete': { bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-700 dark:text-orange-400' },
  'Serviços de Locação':            { bg: 'bg-pink-100 dark:bg-pink-900/30',        text: 'text-pink-700 dark:text-pink-400' },
  'Serviços de Manutenção':         { bg: 'bg-rose-100 dark:bg-rose-900/30',        text: 'text-rose-700 dark:text-rose-400' },
  'Insumos Operacionais':           { bg: 'bg-slate-100 dark:bg-slate-800',         text: 'text-slate-700 dark:text-slate-400' },
};

const RATING_LABELS: Record<number, string> = {
  5: '⭐⭐⭐⭐⭐',
  4: '⭐⭐⭐⭐',
  3: '⭐⭐⭐',
  2: '⭐⭐',
  1: '⭐',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const AVATAR_COLORS = [
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40',   text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40',       text: 'text-rose-700 dark:text-rose-300' },
];

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export const SuppliersList = ({ suppliers, ytdSpend, onView, onEdit, onDelete }: SuppliersListProps) => {
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
        <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Nenhum fornecedor encontrado</p>
        <p className="text-xs text-muted-foreground">Ajuste os filtros ou cadastre um novo fornecedor.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_88px] gap-0 px-4 py-2.5 bg-muted/50 border-b border-border">
        {['Fornecedor', 'Categoria', 'Gasto (2026)', 'Lead time', 'Distância', ''].map((h, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {/* Rows */}
      {suppliers.map((supplier) => {
        const color    = avatarColor(supplier.companyName);
        const catStyle = CATEGORY_COLORS[supplier.mainCategory || ''];
        const spend    = ytdSpend[supplier.id] || 0;
        const inactive = supplier.status === 'Inativo';

        return (
          <div
            key={supplier.id}
            className={`grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_88px] gap-0 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${inactive ? 'opacity-50' : ''}`}
          >
            {/* Fornecedor */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${color.bg} ${color.text}`}>
                {initials(supplier.companyName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{supplier.companyName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {supplier.pixKey ? `PIX: ${supplier.pixKey}` : supplier.cnpjCpf || (supplier.whatsapp ? `WhatsApp: ${supplier.whatsapp}` : '—')}
                </p>
              </div>
            </div>

            {/* Categoria + Status */}
            <div className="flex flex-col justify-center gap-1">
              {supplier.mainCategory && catStyle ? (
                <span className={`inline-flex w-fit text-xs px-2 py-0.5 rounded-full font-medium ${catStyle.bg} ${catStyle.text}`}>
                  {supplier.mainCategory}
                </span>
              ) : supplier.mainCategory ? (
                <span className="inline-flex w-fit text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {supplier.mainCategory}
                </span>
              ) : null}
              <Badge variant={supplier.status === 'Ativo' ? 'default' : 'secondary'} className="w-fit text-xs">
                {supplier.status}
              </Badge>
            </div>

            {/* Gasto YTD */}
            <div className="flex items-center">
              <span className="text-sm font-medium text-foreground">
                {spend > 0 ? formatCurrency(spend) : <span className="text-muted-foreground">—</span>}
              </span>
            </div>

            {/* Lead time */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                {supplier.leadTimeDays ? `${supplier.leadTimeDays} dia${supplier.leadTimeDays !== 1 ? 's' : ''}` : '—'}
              </span>
            </div>

            {/* Distância */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                {supplier.distanceKm ? `${supplier.distanceKm} km` : '—'}
              </span>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onView(supplier)} title="Ver detalhes">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(supplier)} title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm('Excluir este fornecedor?')) onDelete(supplier.id); }}
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
