import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

export const PaymentMethodsManager = () => {
  const { methods, loading, reload } = usePaymentMethods(false); // carrega todos
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    // Verificar duplicata (case-insensitive)
    const exists = methods.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast.error(`"${name}" já existe`);
      return;
    }

    setAdding(true);
    const maxOrder = methods.reduce((max, m) => Math.max(max, m.display_order), 0);
    const { error } = await supabase
      .from("payment_methods")
      .insert({ name, display_order: maxOrder + 1 });

    if (error) {
      toast.error("Erro ao adicionar forma de pagamento");
    } else {
      toast.success(`"${name}" adicionado`);
      setNewName("");
      reload();
    }
    setAdding(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      reload();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    // Verificar se existe em uso
    const { count } = await supabase
      .from("payment_transactions")
      .select("id", { count: "exact", head: true })
      .eq("payment_method", name);

    if ((count || 0) > 0) {
      toast.error(`Não é possível excluir "${name}" — existem ${count} lançamento(s) usando este método. Desative-o ao invés de excluir.`);
      return;
    }

    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success(`"${name}" removido`);
      reload();
    }
  };

  const active   = methods.filter(m => m.is_active);
  const inactive = methods.filter(m => !m.is_active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Formas de Pagamento
        </CardTitle>
        <CardDescription>
          Gerencie os métodos de pagamento disponíveis em todos os lançamentos financeiros.
          Métodos desativados deixam de aparecer nos formulários mas preservam o histórico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Adicionar novo */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome da nova forma de pagamento..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {loading ? (
          <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <>
            {/* Métodos ativos */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Ativos ({active.length})
              </p>
              {active.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-background px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <span className="font-medium text-sm">{m.name}</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">Ativo</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={() => handleToggle(m.id, m.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(m.id, m.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Métodos inativos */}
            {inactive.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Inativos / Legado ({inactive.length})
                </p>
                {inactive.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-dashed bg-muted/30 px-4 py-2.5 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      <span className="text-sm line-through text-muted-foreground">{m.name}</span>
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={() => handleToggle(m.id, m.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(m.id, m.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
