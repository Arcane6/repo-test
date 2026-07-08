// Espelha modules/mobile_access/shared/constants.py — mantém front e back
// consistentes sem round-trip de API só para pegar uma cor.
export const TECH_COLORS: Record<string, string> = {
  "2G": "#1E88E5",
  "3G": "#E53935",
  "4G": "#F5C518",
  "5G": "#7DC242",
};

export const TECH_ORDER = ["2G", "3G", "4G", "5G"];

export const TIM_BRAND_COLOR = "#003399";
