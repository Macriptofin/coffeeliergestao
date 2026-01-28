import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ConfigNamespace {
  id: string;
  key: string;
  label: string;
  created_at: string;
}

export interface ConfigOption {
  id: string;
  namespace_id: string;
  key: string;
  value_type: string; // Will be validated at runtime
  default_value: any;
  description: string;
}

export interface ConfigValue {
  id: string;
  namespace_id: string;
  key: string;
  value_jsonb: any;
  updated_by?: string;
  updated_at: string;
}

export interface TaxonomyDefinition {
  id: string;
  key: string;
  label: string;
  module_key: string;
  created_at: string;
}

export interface TaxonomyTerm {
  id: string;
  taxonomy_id: string;
  parent_id?: string;
  code?: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  children?: TaxonomyTerm[];
}

export function useConfig() {
  const [namespaces, setNamespaces] = useState<ConfigNamespace[]>([]);
  const [options, setOptions] = useState<ConfigOption[]>([]);
  const [values, setValues] = useState<ConfigValue[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all configuration data
  const fetchConfig = async () => {
    try {
      setLoading(true);
      
      const [namespacesRes, optionsRes, valuesRes] = await Promise.all([
        supabase.from('config_namespaces').select('*').order('key'),
        supabase.from('config_options').select('*').order('key'),
        supabase.from('config_values').select('*')
      ]);

      if (namespacesRes.error) throw namespacesRes.error;
      if (optionsRes.error) throw optionsRes.error;
      if (valuesRes.error) throw valuesRes.error;

      setNamespaces(namespacesRes.data || []);
      setOptions(optionsRes.data || []);
      setValues(valuesRes.data || []);
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: "Não foi possível carregar as configurações do sistema.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get config value with fallback to default
  const getConfigValue = (namespaceKey: string, optionKey: string) => {
    const namespace = namespaces.find(n => n.key === namespaceKey);
    if (!namespace) return null;

    const value = values.find(v => v.namespace_id === namespace.id && v.key === optionKey);
    if (value) return value.value_jsonb;

    const option = options.find(o => o.namespace_id === namespace.id && o.key === optionKey);
    return option?.default_value || null;
  };

  // Set config value (silent mode for batch operations)
  const setConfigValue = async (namespaceKey: string, optionKey: string, value: any, silent: boolean = false) => {
    try {
      const namespace = namespaces.find(n => n.key === namespaceKey);
      if (!namespace) throw new Error('Namespace não encontrado');

      const { error } = await supabase
        .from('config_values')
        .upsert(
          {
            namespace_id: namespace.id,
            key: optionKey,
            value_jsonb: value,
          },
          { onConflict: 'namespace_id,key' }
        );

      if (error) throw error;

      // Update local state
      setValues(prev => {
        const existing = prev.find(v => v.namespace_id === namespace.id && v.key === optionKey);
        if (existing) {
          return prev.map(v => 
            v.namespace_id === namespace.id && v.key === optionKey 
              ? { ...v, value_jsonb: value, updated_at: new Date().toISOString() }
              : v
          );
        } else {
          return [...prev, {
            id: crypto.randomUUID(),
            namespace_id: namespace.id,
            key: optionKey,
            value_jsonb: value,
            updated_at: new Date().toISOString(),
          }];
        }
      });

      if (!silent) {
        toast({
          title: "Configuração salva",
          description: "A configuração foi salva com sucesso.",
        });
      }

      return true;
    } catch (error) {
      console.error('Error setting config value:', error);
      if (!silent) {
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar a configuração.",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  // Get options by namespace
  const getOptionsByNamespace = (namespaceKey: string) => {
    const namespace = namespaces.find(n => n.key === namespaceKey);
    if (!namespace) return [];
    return options.filter(o => o.namespace_id === namespace.id);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    namespaces,
    options,
    values,
    loading,
    fetchConfig,
    getConfigValue,
    setConfigValue,
    getOptionsByNamespace,
  };
}

export function useTaxonomy() {
  const [definitions, setDefinitions] = useState<TaxonomyDefinition[]>([]);
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTaxonomies = async () => {
    try {
      setLoading(true);
      
      const [defsRes, termsRes] = await Promise.all([
        supabase.from('taxonomy_definitions').select('*').order('key'),
        supabase.from('taxonomy_terms').select('*').order('sort_order')
      ]);

      if (defsRes.error) throw defsRes.error;
      if (termsRes.error) throw termsRes.error;

      setDefinitions(defsRes.data || []);
      
      // Build hierarchical structure
      const allTerms = termsRes.data || [];
      const termsWithChildren = allTerms.map(term => ({
        ...term,
        children: allTerms.filter(child => child.parent_id === term.id)
      }));
      
      setTerms(termsWithChildren);
    } catch (error) {
      console.error('Error fetching taxonomies:', error);
      toast({
        title: "Erro ao carregar taxonomias",
        description: "Não foi possível carregar as taxonomias.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTermsByTaxonomy = (taxonomyKey: string) => {
    const taxonomy = definitions.find(d => d.key === taxonomyKey);
    if (!taxonomy) return [];
    // Return all terms for the taxonomy (both roots and children). Callers can filter by parent_id as needed.
    return terms.filter(t => t.taxonomy_id === taxonomy.id);
  };

  const createTerm = async (taxonomyKey: string, termData: Omit<TaxonomyTerm, 'id' | 'taxonomy_id' | 'created_at' | 'children'>) => {
    try {
      const taxonomy = definitions.find(d => d.key === taxonomyKey);
      if (!taxonomy) throw new Error('Taxonomia não encontrada');

      const { data, error } = await supabase
        .from('taxonomy_terms')
        .insert([{
          taxonomy_id: taxonomy.id,
          ...termData,
        }])
        .select()
        .single();

      if (error) throw error;

      setTerms(prev => [...prev, { ...data, children: [] }]);
      
      toast({
        title: "Termo criado",
        description: "O termo foi criado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Error creating term:', error);
      toast({
        title: "Erro ao criar termo",
        description: "Não foi possível criar o termo.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTerm = async (termId: string, updates: Partial<TaxonomyTerm>) => {
    try {
      const { error } = await supabase
        .from('taxonomy_terms')
        .update(updates)
        .eq('id', termId);

      if (error) throw error;

      setTerms(prev => prev.map(t => 
        t.id === termId ? { ...t, ...updates } : t
      ));

      toast({
        title: "Termo atualizado",
        description: "O termo foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Error updating term:', error);
      toast({
        title: "Erro ao atualizar termo",
        description: "Não foi possível atualizar o termo.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTerm = async (termId: string) => {
    try {
      const { error } = await supabase
        .from('taxonomy_terms')
        .delete()
        .eq('id', termId);

      if (error) throw error;

      setTerms(prev => prev.filter(t => t.id !== termId));

      toast({
        title: "Termo excluído",
        description: "O termo foi excluído com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting term:', error);
      toast({
        title: "Erro ao excluir termo",
        description: "Não foi possível excluir o termo.",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchTaxonomies();
  }, []);

  return {
    definitions,
    terms,
    loading,
    fetchTaxonomies,
    getTermsByTaxonomy,
    createTerm,
    updateTerm,
    deleteTerm,
  };
}