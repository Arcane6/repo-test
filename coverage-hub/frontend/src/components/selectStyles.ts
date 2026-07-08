import type { StylesConfig } from "react-select";

/**
 * Estilos do react-select usando as variáveis CSS do tema (--tim-*), pra
 * acompanhar claro/escuro automaticamente sem precisar recalcular nada
 * em JS quando o tema muda.
 */
export function themedSelectStyles<Option, IsMulti extends boolean>(): StylesConfig<
  Option,
  IsMulti
> {
  return {
    control: (base) => ({
      ...base,
      backgroundColor: "var(--tim-card-bg)",
      borderColor: "var(--tim-card-border)",
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "var(--tim-card-bg)",
      zIndex: 20,
    }),
    singleValue: (base) => ({ ...base, color: "var(--tim-text)" }),
    input: (base) => ({ ...base, color: "var(--tim-text)" }),
    placeholder: (base) => ({ ...base, color: "var(--tim-text-muted)" }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--tim-hover-bg)" : "var(--tim-card-bg)",
      color: "var(--tim-text)",
    }),
    multiValue: (base) => ({ ...base, backgroundColor: "var(--tim-hover-bg)" }),
    multiValueLabel: (base) => ({ ...base, color: "var(--tim-text)" }),
  };
}
