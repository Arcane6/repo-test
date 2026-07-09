/**
 * Placeholder de carregamento genérico — shimmer sutil em cima da cor
 * de card do tema atual. Usa `height`/`width` como qualquer bloco; não
 * depende de saber o que vai aparecer ali (número, gráfico, linha de
 * tabela...).
 */
export function Skeleton({
  height = 16,
  width = "100%",
  radius = 6,
  className = "",
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`tim-skeleton ${className}`}
      style={{ display: "block", height, width, borderRadius: radius }}
    />
  );
}
