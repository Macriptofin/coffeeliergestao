import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierForm, Supplier } from "@/components/SupplierForm";
import { SuppliersList } from "@/components/SuppliersList";

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('company_name');
      
      if (error) throw error;
      
      const formattedSuppliers = data.map(item => ({
        id: item.id,
        code: item.code,
        status: item.status as 'Ativo' | 'Inativo',
        companyName: item.company_name,
        tradeName: item.trade_name || undefined,
        cnpjCpf: item.cnpj_cpf || undefined,
        contactName: item.contact_name || undefined,
        phone: item.phone || undefined,
        email: item.email || undefined,
        address: item.address || undefined,
        city: item.city || undefined,
        state: item.state || undefined,
        zipCode: item.zip_code || undefined,
        mainCategory: item.main_category || undefined,
        paymentTerms: item.payment_terms || 30,
        minimumOrderValue: parseFloat(item.minimum_order_value?.toString() || '0'),
        notes: item.notes || undefined
      }));
      
      setSuppliers(formattedSuppliers);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'code'>) => {
    try {
      // Gerar código automático
      const { data: existingSuppliers } = await supabase
        .from('suppliers')
        .select('code')
        .order('code', { ascending: false })
        .limit(1);
      
      const lastCode = existingSuppliers?.[0]?.code || 'FORN-0000';
      const nextNumber = parseInt(lastCode.split('-')[1]) + 1;
      const newCode = `FORN-${nextNumber.toString().padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          code: newCode,
          status: supplier.status,
          company_name: supplier.companyName,
          trade_name: supplier.tradeName,
          cnpj_cpf: supplier.cnpjCpf,
          contact_name: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          city: supplier.city,
          state: supplier.state,
          zip_code: supplier.zipCode,
          main_category: supplier.mainCategory,
          payment_terms: supplier.paymentTerms,
          minimum_order_value: supplier.minimumOrderValue,
          notes: supplier.notes
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newSupplier: Supplier = {
        id: data.id,
        code: data.code,
        status: data.status as 'Ativo' | 'Inativo',
        companyName: data.company_name,
        tradeName: data.trade_name || undefined,
        cnpjCpf: data.cnpj_cpf || undefined,
        contactName: data.contact_name || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zip_code || undefined,
        mainCategory: data.main_category || undefined,
        paymentTerms: data.payment_terms || 30,
        minimumOrderValue: parseFloat(data.minimum_order_value?.toString() || '0'),
        notes: data.notes || undefined
      };
      
      setSuppliers([...suppliers, newSupplier]);
      setShowSupplierForm(false);
      toast.success('Fornecedor cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar fornecedor:', error);
      toast.error('Erro ao cadastrar fornecedor');
    }
  };

  const updateSupplier = async (updatedSupplier: Supplier) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          status: updatedSupplier.status,
          company_name: updatedSupplier.companyName,
          trade_name: updatedSupplier.tradeName,
          cnpj_cpf: updatedSupplier.cnpjCpf,
          contact_name: updatedSupplier.contactName,
          phone: updatedSupplier.phone,
          email: updatedSupplier.email,
          address: updatedSupplier.address,
          city: updatedSupplier.city,
          state: updatedSupplier.state,
          zip_code: updatedSupplier.zipCode,
          main_category: updatedSupplier.mainCategory,
          payment_terms: updatedSupplier.paymentTerms,
          minimum_order_value: updatedSupplier.minimumOrderValue,
          notes: updatedSupplier.notes
        })
        .eq('id', updatedSupplier.id);
      
      if (error) throw error;
      
      setSuppliers(suppliers.map(sup => 
        sup.id === updatedSupplier.id ? updatedSupplier : sup
      ));
      setEditingSupplier(null);
      setShowSupplierForm(false);
      toast.success('Fornecedor atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      toast.error('Erro ao atualizar fornecedor');
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);
      
      if (error) throw error;
      
      setSuppliers(suppliers.filter(sup => sup.id !== supplierId));
      toast.success('Fornecedor excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const handleSupplierSubmit = (supplierData: Omit<Supplier, 'id' | 'code'>) => {
    if (editingSupplier) {
      updateSupplier({ ...supplierData, id: editingSupplier.id, code: editingSupplier.code });
    } else {
      addSupplier(supplierData);
    }
  };

  const startEditingSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
  };

  const cancelSupplierForm = () => {
    setEditingSupplier(null);
    setShowSupplierForm(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestão de Fornecedores</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os fornecedores da sua confeitaria</p>
        </div>
        <Button 
          onClick={() => setShowSupplierForm(true)}
          className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {showSupplierForm && (
        <div className="mb-8">
          <SupplierForm 
            supplier={editingSupplier}
            onSubmit={handleSupplierSubmit}
            onCancel={cancelSupplierForm}
          />
        </div>
      )}

      <SuppliersList 
        suppliers={suppliers} 
        onEdit={startEditingSupplier}
        onDelete={deleteSupplier}
      />
    </div>
  );
};

export default Suppliers;