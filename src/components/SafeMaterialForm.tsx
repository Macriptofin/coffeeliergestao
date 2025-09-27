import React from 'react';
import { MaterialForm } from './MaterialForm';
import { Material } from '@/types';

interface SafeMaterialFormProps {
  material?: Material | null;
  existingMaterials: Material[];
  onSubmit: (material: Omit<Material, 'id' | 'code'>) => void;
  onCancel: () => void;
}

export const SafeMaterialForm: React.FC<SafeMaterialFormProps> = (props) => {
  try {
    return <MaterialForm {...props} />;
  } catch (error) {
    console.error('Erro no MaterialForm:', error);
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <h3 className="font-medium text-red-800 mb-2">Erro no formulário</h3>
        <p className="text-red-600 text-sm mb-4">
          Ocorreu um erro ao carregar o formulário de material.
        </p>
        <button 
          onClick={props.onCancel}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Fechar
        </button>
      </div>
    );
  }
};