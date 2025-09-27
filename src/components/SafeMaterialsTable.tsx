import React from 'react';
import { MaterialsTable } from './MaterialsTable';
import { Material } from '@/types';

interface SafeMaterialsTableProps {
  materials: Material[];
  onEdit: (material: Material) => void;
  onDelete: (materialId: string) => void;
  selectedMaterials: string[];
  onSelectMaterial: (materialId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export const SafeMaterialsTable: React.FC<SafeMaterialsTableProps> = (props) => {
  try {
    // Validar props antes de renderizar
    if (!Array.isArray(props.materials)) {
      console.warn('Materials não é um array:', props.materials);
      return (
        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
          <p className="text-yellow-800">Dados inválidos recebidos. Recarregue a página.</p>
        </div>
      );
    }

    return <MaterialsTable {...props} />;
  } catch (error) {
    console.error('Erro no MaterialsTable:', error);
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <h3 className="font-medium text-red-800 mb-2">Erro na tabela</h3>
        <p className="text-red-600 text-sm">
          Erro ao renderizar a tabela de materiais: {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }
};