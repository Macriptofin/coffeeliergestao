import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';

interface CatalogRow {
  id: string; material_id: string; is_active: boolean;
  materials?: { name: string; category: string | null; subcategory: string | null } | null;
}

// Curadoria do catálogo do portal por cliente: define quais produtos vendáveis o cliente pode pedir.
export default function ClientPortalCatalog({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: items = [], isPending } = useQuery({
    queryKey: ['client-catalog', clientId],
    queryFn: async (): Promise<CatalogRow[]> => {
      const { data, error } = await supabase
        .from('client_catalog_items')
        .select('id, material_id, is_active, materials(name, category, subcategory)')
        .eq('client_id', clientId);
      if (error) throw error;
      return (data || []) as CatalogRow[];
    },
  });

  const inCatalog = new Set(items.map(i => i.material_id));

  const { data: results = [] } = useQuery({
    queryKey: ['catalog-search', search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, category, subcategory')
        .eq('is_sellable', true).eq('is_archived', false)
        .ilike('name', `%${search.trim()}%`)
        .order('name').limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['client-catalog', clientId] });

  const add = async (material_id: string) => {
    const { error } = await supabase.from('client_catalog_items')
      .insert({ client_id: clientId, material_id });
    if (error) { toast.error('Erro ao adicionar.'); return; }
    toast.success('Produto liberado para o cliente.');
    refetch();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('client_catalog_items').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover.'); return; }
    refetch();
  };
  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from('client_catalog_items').update({ is_active: !active }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-muted/30">
        <h3 className="font-semibold flex items-center gap-2 mb-1"><PackageSearch className="h-4 w-4" /> Catálogo do portal</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Produtos que este cliente poderá escolher ao montar um pedido no portal. Busque e adicione itens vendáveis.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto vendável (mín. 2 letras)…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search.trim().length >= 2 && (
          <div className="mt-2 border rounded-lg divide-y max-h-64 overflow-auto bg-card">
            {results.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</div>
            ) : results.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.category}{m.subcategory ? ` · ${m.subcategory}` : ''}</div>
                </div>
                {inCatalog.has(m.id) ? (
                  <Badge variant="secondary">Já no catálogo</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => add(m.id)}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isPending ? (
        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto no catálogo deste cliente ainda. Use a busca acima.</p>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{items.length} produto(s) no catálogo</div>
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it.materials?.name || 'Produto'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {it.materials?.category}{it.materials?.subcategory ? ` · ${it.materials?.subcategory}` : ''}
                </div>
              </div>
              {!it.is_active && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
              <Button variant="ghost" size="sm" onClick={() => toggle(it.id, it.is_active)}>
                {it.is_active ? 'Desativar' : 'Reativar'}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
