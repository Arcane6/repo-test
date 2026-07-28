import { AssistantChat } from "../components/AssistantChat";

export function AssistantDashboard() {
  return (
    <div className="tim-page-enter">
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span className="tim-eyebrow">Assistente de IA — Acesso Móvel</span>
      </div>

      <AssistantChat />
    </div>
  );
}
