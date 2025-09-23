import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { Supplier } from "./SupplierForm";

interface SuppliersListProps {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplierId: string) => void;
}

export const SuppliersList = ({ suppliers, onEdit, onDelete }: SuppliersListProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDocument = (doc?: string) => {
    if (!doc) return '';
    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length === 11) {
      // CPF
      return cleanDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleanDoc.length === 14) {
      // CNPJ
      return cleanDoc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum fornecedor cadastrado</h3>
          <p className="text-sm text-muted-foreground text-center">
            Cadastre fornecedores para gerenciar seus contatos comerciais e facilitar o processo de compras.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {suppliers.map((supplier) => (
        <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{supplier.companyName}</CardTitle>
                {supplier.tradeName && (
                  <CardDescription className="text-sm font-medium">
                    {supplier.tradeName}
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={supplier.status === 'Ativo' ? 'default' : 'secondary'}>
                  {supplier.status}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {supplier.code}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Categoria */}
            {supplier.mainCategory && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.mainCategory}</span>
              </div>
            )}

            {/* Documento */}
            {supplier.cnpjCpf && (
              <div className="text-sm text-muted-foreground">
                {formatDocument(supplier.cnpjCpf)}
              </div>
            )}

            {/* Contato */}
            <div className="space-y-2">
              {supplier.contactName && (
                <div className="text-sm">
                  <span className="font-medium">Contato:</span> {supplier.contactName}
                </div>
              )}
              
              {supplier.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{supplier.phone}</span>
                </div>
              )}
              
              {supplier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{supplier.email}</span>
                </div>
              )}
            </div>

            {/* Localização */}
            {(supplier.city || supplier.state) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {[supplier.city, supplier.state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {/* Condições Comerciais */}
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Prazo: {supplier.paymentTerms} dias</div>
              {supplier.minimumOrderValue > 0 && (
                <div>Pedido mínimo: {formatCurrency(supplier.minimumOrderValue)}</div>
              )}
            </div>

            {/* Notas */}
            {supplier.notes && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                <div className="line-clamp-2">{supplier.notes}</div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(supplier)}
                className="flex-1"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este fornecedor?')) {
                    onDelete(supplier.id);
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};