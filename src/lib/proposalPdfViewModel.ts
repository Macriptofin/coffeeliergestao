// Tipos e transformação puros do PDF formatado de proposta — compartilhados entre
// o gerador interno (Vendas, dados via tabelas) e o do Portal (dados via RPC segura).
// A entrada (propRow/compsRows/catsRows) espelha o shape relacional do Supabase
// (objetos aninhados tipo `clients(name, cnpj_cpf)`), pra caber nos dois casos.

export interface ProposalData {
  id: string;
  proposal_number: string;
  revision: number;
  event_name: string;
  event_category: string;
  number_of_people: number;
  event_date: string;
  total_amount: number;
  target_weight_per_person: number;
  status: string;
  client_name: string;
  cnpj_cpf: string;
  department_name: string;
  unit_name: string;
  unit_address: string;
  room_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  payment_terms: string;
  // Guarda-chuva (contrato recorrente): a tabela de Orçamento vira
  // quantidade contratada × preço unitário = valor total.
  is_umbrella: boolean;
  umbrella_quota_quantity: number | null;
  umbrella_quota_unit_price: number | null;
}

export interface MenuItem {
  name: string;
  qty_per_person: number;
  fixed_qty: number;
  unit: string;
  unit_weight: number;     // conteúdo por unidade (g comida / mL bebida)
  is_beverage: boolean;
}

export interface MenuSection {
  label: string;
  items: MenuItem[];
}

export interface Composition {
  id: string;
  name: string;
  event_category: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  room_name: string | null;
  location: string | null;
  price_per_person: number;
  number_of_people: number;
  service_code: string | null;
  sections: MenuSection[];
}

// Ordem canônica + mapa KEY -> LABEL das seções do cardápio. Chaves espelham
// SECTIONS de ProposalEditor.tsx/PortalNovoPedido.tsx (é o que é gravado em
// proposal_categories.category_label pelos dois compositores).
export const SECTION_ORDER = ['salgados', 'doces', 'light', 'bebidas'];
export const SECTION_LABELS: Record<string, string> = {
  salgados: 'Salgados',
  doces:    'Doces',
  light:    'Light',
  bebidas:  'Bebidas',
};

export function buildProposalData(p: any): ProposalData | null {
  if (!p) return null;
  return {
    id: p.id,
    proposal_number: p.proposal_number,
    revision: p.revision ?? 1,
    event_name: p.event_name || '',
    event_category: p.event_category,
    number_of_people: p.number_of_people,
    event_date: p.event_date,
    total_amount: parseFloat(p.total_amount || 0),
    target_weight_per_person: parseFloat(p.target_weight_per_person || 0),
    status: p.status,
    client_name: p.clients?.name || '—',
    cnpj_cpf: p.clients?.cnpj_cpf || '',
    department_name: p.client_departments?.name || '',
    unit_name: p.client_units?.name || '',
    unit_address: p.client_units?.address || '',
    room_name: p.client_rooms?.name || '',
    contact_name: p.client_contacts?.name || '',
    contact_email: p.client_contacts?.email || '',
    contact_phone: p.client_contacts?.phone || '',
    // Condição da proposta tem prioridade; sem ela, cai pra condição padrão do
    // cadastro do cliente (nunca hardcoded — cada cliente pode ter a sua, ex.: CMPC).
    payment_terms: p.payment_terms || p.clients?.payment_terms || '',
    is_umbrella: !!p.is_umbrella,
    umbrella_quota_quantity: p.umbrella_quota_quantity != null ? parseFloat(p.umbrella_quota_quantity) : null,
    umbrella_quota_unit_price: p.umbrella_quota_unit_price != null ? parseFloat(p.umbrella_quota_unit_price) : null,
  };
}

// Agrupa categorias por composição (momento) → seção → itens.
export function buildCompositions(rawComps: any[], rawCats: any[]): Composition[] {
  // Converte uma linha de categoria em MenuSection (apenas se tiver itens).
  const toSection = (c: any): MenuSection | null => {
    const items: MenuItem[] = (c.proposal_category_items || []).map((it: any) => ({
      name: it.materials?.name || '—',
      qty_per_person: parseFloat(it.qty_per_person || 0),
      fixed_qty: parseFloat(it.fixed_qty || 0),
      unit: it.materials?.usage_unit || 'un',
      unit_weight: parseFloat(it.materials?.unit_weight || 0),
      is_beverage: it.materials?.category === 'Bebidas',
    }));
    if (items.length === 0) return null;
    const key = (c.category_label || '').toLowerCase();
    // KEY conhecida → label canônica; legado/desconhecida → label cru.
    const label = SECTION_LABELS[key] || c.category_label || '—';
    return { label, items };
  };

  // Ordena seções de uma composição pela ordem canônica; desconhecidas no fim.
  const orderSections = (cats: any[]): MenuSection[] => {
    const sorted = [...cats].sort((a, b) => {
      const ka = (a.category_label || '').toLowerCase();
      const kb = (b.category_label || '').toLowerCase();
      const ia = SECTION_ORDER.indexOf(ka);
      const ib = SECTION_ORDER.indexOf(kb);
      const ra = ia === -1 ? SECTION_ORDER.length : ia;
      const rb = ib === -1 ? SECTION_ORDER.length : ib;
      if (ra !== rb) return ra - rb;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    return sorted.map(toSection).filter(Boolean) as MenuSection[];
  };

  let comps: Composition[];

  if (rawComps.length > 0) {
    // Caso normal: múltiplas composições (momentos).
    comps = rawComps.map((cp: any) => ({
      id: cp.id,
      name: cp.name || '',
      event_category: cp.event_category || null,
      scheduled_date: cp.scheduled_date || null,
      scheduled_time: cp.scheduled_time || null,
      room_name: cp.client_rooms?.name || null,
      location: cp.location || null,
      price_per_person: parseFloat(cp.price_per_person || 0),
      number_of_people: cp.number_of_people || 0,
      service_code: cp.service_code || null,
      sections: orderSections(rawCats.filter((c) => c.composition_id === cp.id)),
    }));

    // Categorias órfãs (composition_id NULL) viram uma composição implícita.
    const orphanCats = rawCats.filter((c) => !c.composition_id);
    const orphanSections = orderSections(orphanCats);
    if (orphanSections.length > 0) {
      comps.push({
        id: '__legacy__',
        name: '',
        event_category: null,
        scheduled_date: null,
        scheduled_time: null,
        room_name: null,
        location: null,
        price_per_person: 0,
        number_of_people: 0,
        service_code: null,
        sections: orphanSections,
      });
    }

    // Remove composições sem nenhuma seção com itens.
    comps = comps.filter((c) => c.sections.length > 0);
  } else {
    // Legado: nenhuma composição — uma composição implícita com todas as categorias.
    const sections = orderSections(rawCats);
    comps = sections.length > 0
      ? [{
          id: '__legacy__',
          name: '',
          event_category: null,
          scheduled_date: null,
          scheduled_time: null,
          room_name: null,
          location: null,
          price_per_person: 0,
          number_of_people: 0,
          service_code: null,
          sections,
        }]
      : [];
  }

  return comps;
}
