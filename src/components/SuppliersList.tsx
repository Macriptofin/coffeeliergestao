import { Button } from "@/components/ui/button";
import { Building2, Edit2, Trash2, Eye, Clock, MapPin } from "lucide-react";
import { Supplier, SUPPLIER_CATEGORIES } from "./SupplierForm";

interface SuppliersListProps {
  suppliers: Supplier[];
  ytdSpend: Record<string, number>;
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplierId: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDocument = (doc?: string) => {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

const stars = (rating?: number) => {
  if (!rating) return null;
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
};

export const SuppliersList = ({ suppliers, ytdSpend, onView, onEdit, onDelete }: SuppliersListProps) => {
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-1">Nenhum fornecedor encontrado</h3>
        <p className="text-sm text-muted-foreground">
          Ajuste os filtros ou cadastre um novo fornecedor.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Gasto (2026)</th>
            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Lead time</th>
            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Distância</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier, idx) => {
            const inactive = supplier.status === 'Inativo';
            const spend = ytdSpend[supplier.id] ?? 0;
            return (
              <tr
                key={supplier.id}
                className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${inactive ? 'opacity-50' : ''}`}
              >
                {/* Fornecedor */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        inactive ? 'bg-gray-300' : 'bg-green-500'
                      }`}
                    />
                    <span className="text-xs font-mono text-muted-foreground">{supplier.code}</span>
                  </div>
                  <div className="font-medium leading-snug">{supplier.companyName}</div>
                  {supplier.cnpjCpf && (
                    <div className="text-xs text-muted-foreground">{formatDocument(supplier.cnpjCpf)}</div>
                  )}
                  {supplier.rating && (
                    <div className="text-xs text-amber-500 mt-0.5">{stars(supplier.rating)}</div>
                  )}
                </td>

                {/* Categoria */}
                <td className="px-4 py-3">
                  {supplier.mainCategory ? (
                    <span className="text-sm text-muted-foreground">{supplier.mainCategory}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </td>

                {/* Gasto YTD */}
                <td className="px-4 py-3 text-right tabular-nums">
                  {spend > 0 ? (
                    <span className="font-medium">{formatCurrency(spend)}</span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </td>

                {/* Lead time */}
                <td className="px-4 py-3 text-center">
                  {supplier.leadTimeDays != null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {supplier.leadTimeDays}d
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </td>

                {/* Distância */}
                <td className="px-4 py-3 text-center">
                  {supplier.distanceKm != null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {supplier.distanceKm} km
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </td>

                {/* Ações */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView(supplier)}
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(supplier)}
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir este fornecedor?')) {
                          onDelete(supplier.id);
                        }
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
