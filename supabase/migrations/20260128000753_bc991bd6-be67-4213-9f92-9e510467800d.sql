-- Buscar o ID do namespace 'gerais'
DO $$
DECLARE
  namespace_id_var UUID;
BEGIN
  SELECT id INTO namespace_id_var FROM config_namespaces WHERE key = 'gerais';
  
  -- Informações básicas da empresa
  INSERT INTO config_options (namespace_id, key, description, value_type, default_value)
  VALUES 
    (namespace_id_var, 'empresa_nome_fantasia', 'Nome Fantasia', 'string', '""'),
    (namespace_id_var, 'empresa_cnpj', 'CNPJ', 'string', '""'),
    (namespace_id_var, 'empresa_inscricao_estadual', 'Inscrição Estadual', 'string', '""'),
    (namespace_id_var, 'empresa_inscricao_municipal', 'Inscrição Municipal', 'string', '""'),
    
    -- Endereço
    (namespace_id_var, 'empresa_endereco', 'Endereço', 'string', '""'),
    (namespace_id_var, 'empresa_numero', 'Número', 'string', '""'),
    (namespace_id_var, 'empresa_complemento', 'Complemento', 'string', '""'),
    (namespace_id_var, 'empresa_bairro', 'Bairro', 'string', '""'),
    (namespace_id_var, 'empresa_cidade', 'Cidade', 'string', '""'),
    (namespace_id_var, 'empresa_estado', 'Estado (UF)', 'string', '""'),
    (namespace_id_var, 'empresa_cep', 'CEP', 'string', '""'),
    
    -- Contatos
    (namespace_id_var, 'empresa_telefone', 'Telefone', 'string', '""'),
    (namespace_id_var, 'empresa_celular', 'Celular / WhatsApp', 'string', '""'),
    (namespace_id_var, 'empresa_email', 'E-mail', 'string', '""'),
    (namespace_id_var, 'empresa_website', 'Website', 'string', '""'),
    (namespace_id_var, 'empresa_instagram', 'Instagram', 'string', '""'),
    
    -- Dados bancários
    (namespace_id_var, 'empresa_banco_nome', 'Nome do Banco', 'string', '""'),
    (namespace_id_var, 'empresa_banco_agencia', 'Agência', 'string', '""'),
    (namespace_id_var, 'empresa_banco_conta', 'Conta', 'string', '""'),
    (namespace_id_var, 'empresa_banco_tipo', 'Tipo de Conta (Corrente/Poupança)', 'string', '""'),
    (namespace_id_var, 'empresa_pix', 'Chave PIX', 'string', '""'),
    
    -- Responsável
    (namespace_id_var, 'empresa_responsavel_nome', 'Nome do Responsável', 'string', '""'),
    (namespace_id_var, 'empresa_responsavel_cpf', 'CPF do Responsável', 'string', '""'),
    (namespace_id_var, 'empresa_responsavel_cargo', 'Cargo do Responsável', 'string', '""')
  ON CONFLICT DO NOTHING;
END $$;