// Geolocalização / distância — utilitário compartilhado (clientes e fornecedores).
// Hoje: CEP → BrasilAPI → Haversine a partir da sede. Aproximado (centroide do CEP,
// distância em linha reta). Arquitetado para trocar por provedor pago (Google Routes/
// Mapbox = distância de rota real) sem mudar os chamadores. Ver memória logistics-freight-model.
import { supabase } from '@/integrations/supabase/client';

// Fallback: centro de Guaíba/RS caso o CEP da sede não tenha cobertura de coordenadas.
const HQ_FALLBACK = { lat: -30.1126, lon: -51.3243 };

const toRad = (deg: number): number => (deg * Math.PI) / 180;

// Distância em km entre dois pontos (lat/lng) — fórmula de Haversine.
export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Geocodifica um CEP via BrasilAPI. Retorna null se inválido/sem cobertura.
async function geocodeCep(cep: string): Promise<{ lat: number; lon: number } | null> {
  const clean = (cep ?? '').replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.location?.coordinates;
    const lat = parseFloat(c?.latitude);
    const lon = parseFloat(c?.longitude);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// Coordenadas da sede (CEP em Configurações > gerais > empresa_cep; fallback Guaíba).
async function getHqCoords(): Promise<{ lat: number; lon: number }> {
  try {
    const { data: nsRow } = await supabase
      .from('config_namespaces').select('id').eq('key', 'gerais').single();
    const { data: cepRow } = await supabase
      .from('config_values').select('value_jsonb')
      .eq('namespace_id', nsRow?.id).eq('key', 'empresa_cep').single();
    const hqCep = ((cepRow?.value_jsonb as string) ?? '').replace(/\D/g, '');
    const coords = await geocodeCep(hqCep);
    if (coords) return coords;
  } catch {
    /* ignora — usa fallback */
  }
  return HQ_FALLBACK;
}

// Distância (km, 1 casa) da sede até o CEP informado. null se não der para calcular.
export async function computeDistanceKmFromCep(cep: string): Promise<number | null> {
  const dest = await geocodeCep(cep);
  if (!dest) return null;
  const hq = await getHqCoords();
  const km = haversine(hq.lat, hq.lon, dest.lat, dest.lon);
  return Math.round(km * 10) / 10;
}
