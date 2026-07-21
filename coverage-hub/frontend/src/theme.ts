// Espelha modules/mobile_access/shared/constants.py — mantém front e back
// consistentes sem round-trip de API só para pegar uma cor.
export const TECH_COLORS: Record<string, string> = {
  "2G": "#1E88E5",
  "3G": "#E53935",
  "4G": "#F5C518",
  "5G": "#7DC242",
};

export const TECH_ORDER = ["2G", "3G", "4G", "5G"];

/** Cor por tecnologia de rádio — fonte ÚNICA pra todo o portal. Qualquer
 * gráfico que quebre por 2G/3G/4G/5G (Cidades, Sites, Tráfego, Transporte)
 * usa este mapa, nunca cores locais. "MM" (mmWave) aparece em algumas
 * strings de TECNOLOGIA — mapeado pro tom do 5G (é camada 5G). */
export function techColor(tec: string): string {
  return TECH_COLORS[tec] ?? (tec === "MM" ? "#4CAF50" : "#B0BEC5");
}

/** Cor por mídia de transporte (módulo Transporte). Semântica: fibra em
 * verde (padrão-ouro), rádio/legado em tons quentes, satélite em roxo,
 * leased/ransharing em neutros. Também fonte única. */
export const TRANSPORT_COLORS: Record<string, string> = {
  FO: "#2E9E5B",   // Fibra Ótica — verde (o objetivo da modernização)
  MW: "#F5A623",   // Microwave — âmbar (legado que sai)
  RS: "#00ACC1",   // RanSharing — teal
  SAT: "#7B1FA2",  // Satélite — roxo
  LL: "#607D8B",   // Leased Line — azul-cinza
  SLS: "#EC407A",  // SLS — rosa
  "N/I": "#B0BEC5", // Não informado
  "Não definido": "#CFD8DC",
};

/** Ordem de exibição das mídias (melhor → pior/legado → indefinido). */
export const TRANSPORT_ORDER = ["FO", "MW", "RS", "SAT", "LL", "SLS", "N/I", "Não definido"];

export const TIM_BRAND_COLOR = "#003399";
