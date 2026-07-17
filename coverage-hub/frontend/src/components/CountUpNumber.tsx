import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Interpreta um número formatado em pt-BR (ex.: "1.234,5", "36,8%").
 * Retorna null se não for numérico (nome de município, "—" etc.). */
function parsePtBr(text: string): { value: number; decimals: number; suffix: string } | null {
  const m = text.trim().match(/^(-?[\d.]*\d(?:,\d+)?)\s*(%?)$/);
  if (!m) return null;
  const numStr = m[1];
  const decimals = numStr.includes(",") ? numStr.split(",")[1].length : 0;
  const value = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(value)) return null;
  return { value, decimals, suffix: m[2] };
}

function fmt(v: number, decimals: number, suffix: string): string {
  return (
    v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  );
}

/**
 * Anima o número do KPI "subindo" até o valor final — o efeito de contador
 * de dashboard executivo. Só numérico: se o texto for um nome (ex.: "São
 * Paulo") ou "—", renderiza direto, sem animar. Interpola a partir do valor
 * anterior (não de 0) quando o KPI muda por filtro, e respeita
 * `prefers-reduced-motion`.
 */
export function CountUpNumber({ text, duration = 0.9 }: { text: string; duration?: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(0);
  const [display, setDisplay] = useState(() => {
    const p = parsePtBr(text);
    return p && !reduce ? fmt(0, p.decimals, p.suffix) : text;
  });

  useEffect(() => {
    const parsed = parsePtBr(text);
    if (!parsed) {
      setDisplay(text);
      return;
    }
    if (reduce) {
      setDisplay(fmt(parsed.value, parsed.decimals, parsed.suffix));
      prev.current = parsed.value;
      return;
    }
    const controls = animate(prev.current, parsed.value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(fmt(v, parsed.decimals, parsed.suffix)),
    });
    prev.current = parsed.value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce]);

  return <>{display}</>;
}
