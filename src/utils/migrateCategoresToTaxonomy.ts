import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoryMigrationResult {
  success: boolean;
  message: string;
  migratedCount: number;
  errors: string[];
}

export async function migrateCategoresToTaxonomy(): Promise<CategoryMigrationResult> {
  const errors: string[] = [];
  let migratedCount = 0;

  try {
    // 1. Buscar todas as categorias e subcategorias únicas dos materiais
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('id, category, subcategory')
      .not('category', 'is', null);

    if (materialsError) {
      return {
        success: false,
        message: `Erro ao buscar materiais: ${materialsError.message}`,
        migratedCount: 0,
        errors: [materialsError.message]
      };
    }

    if (!materials || materials.length === 0) {
      return {
        success: true,
        message: "Nenhum material encontrado para migração",
        migratedCount: 0,
        errors: []
      };
    }

    // 2. Buscar taxonomias existentes
    const { data: taxonomies, error: taxonomyError } = await supabase
      .from('taxonomy_definitions')
      .select('*');

    if (taxonomyError) {
      errors.push(`Erro ao buscar taxonomias: ${taxonomyError.message}`);
      return {
        success: false,
        message: "Erro ao buscar taxonomias existentes",
        migratedCount: 0,
        errors
      };
    }

    const categoryTaxonomy = taxonomies?.find(t => t.key === 'material_category');
    const subcategoryTaxonomy = taxonomies?.find(t => t.key === 'material_subcategory');

    if (!categoryTaxonomy || !subcategoryTaxonomy) {
      return {
        success: false,
        message: "Taxonomias de categoria e subcategoria não encontradas",
        migratedCount: 0,
        errors: ["Taxonomias não encontradas no sistema"]
      };
    }

    // 3. Obter categorias únicas
    const uniqueCategories = [...new Set(materials.map(m => m.category).filter(Boolean))];
    
    // 4. Criar termos de categoria se não existirem
    const { data: existingCategoryTerms } = await supabase
      .from('taxonomy_terms')
      .select('*')
      .eq('taxonomy_id', categoryTaxonomy.id);

    const categoryTermsMap = new Map<string, string>();

    for (const category of uniqueCategories) {
      let existingTerm = existingCategoryTerms?.find(t => 
        t.name.toLowerCase() === category.toLowerCase()
      );

      if (!existingTerm) {
        const { data: newTerm, error: createError } = await supabase
          .from('taxonomy_terms')
          .insert({
            taxonomy_id: categoryTaxonomy.id,
            name: category,
            sort_order: uniqueCategories.indexOf(category) + 1,
            is_active: true
          })
          .select()
          .single();

        if (createError) {
          errors.push(`Erro ao criar categoria ${category}: ${createError.message}`);
          continue;
        }
        existingTerm = newTerm;
      }

      if (existingTerm) {
        categoryTermsMap.set(category, existingTerm.id);
      }
    }

    // 5. Criar termos de subcategoria se não existirem
    const uniqueSubcategories = [...new Set(materials.map(m => m.subcategory).filter(Boolean))];
    
    const { data: existingSubcategoryTerms } = await supabase
      .from('taxonomy_terms')
      .select('*')
      .eq('taxonomy_id', subcategoryTaxonomy.id);

    const subcategoryTermsMap = new Map<string, string>();

    for (const subcategory of uniqueSubcategories) {
      let existingTerm = existingSubcategoryTerms?.find(t => 
        t.name.toLowerCase() === subcategory.toLowerCase()
      );

      if (!existingTerm) {
        const { data: newTerm, error: createError } = await supabase
          .from('taxonomy_terms')
          .insert({
            taxonomy_id: subcategoryTaxonomy.id,
            name: subcategory,
            sort_order: uniqueSubcategories.indexOf(subcategory) + 1,
            is_active: true
          })
          .select()
          .single();

        if (createError) {
          errors.push(`Erro ao criar subcategoria ${subcategory}: ${createError.message}`);
          continue;
        }
        existingTerm = newTerm;
      }

      if (existingTerm) {
        subcategoryTermsMap.set(subcategory, existingTerm.id);
      }
    }

    // 6. Atualizar materiais com os IDs das taxonomias
    for (const material of materials) {
      const updates: any = {};
      
      if (material.category && categoryTermsMap.has(material.category)) {
        updates.category_term_id = categoryTermsMap.get(material.category);
      }
      
      if (material.subcategory && subcategoryTermsMap.has(material.subcategory)) {
        updates.subcategory_term_id = subcategoryTermsMap.get(material.subcategory);
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('materials')
          .update(updates)
          .eq('id', material.id);

        if (updateError) {
          errors.push(`Erro ao atualizar material ${material.id}: ${updateError.message}`);
        } else {
          migratedCount++;
        }
      }
    }

    const success = errors.length === 0;
    
    return {
      success,
      message: success 
        ? `Migração concluída com sucesso! ${migratedCount} materiais atualizados.`
        : `Migração parcialmente concluída. ${migratedCount} materiais atualizados, ${errors.length} erros encontrados.`,
      migratedCount,
      errors
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      message: `Erro inesperado durante a migração: ${errorMessage}`,
      migratedCount,
      errors: [errorMessage]
    };
  }
}

export async function showMigrationDialog() {
  const confirmed = window.confirm(
    'Deseja migrar as categorias existentes para o sistema de taxonomias?\n\n' +
    'Esta operação irá:\n' +
    '• Criar termos de taxonomia para todas as categorias existentes\n' +
    '• Vincular os materiais aos termos corretos\n' +
    '• Manter as categorias atuais como backup\n\n' +
    'Esta operação é segura e pode ser executada múltiplas vezes.'
  );

  if (confirmed) {
    toast.promise(migrateCategoresToTaxonomy(), {
      loading: 'Migrando categorias para taxonomias...',
      success: (result) => result.message,
      error: (error) => `Erro na migração: ${error.message || 'Erro desconhecido'}`
    });
  }
}