"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Action, ApiResponse, Catalog, Direction, Explanation, PlanInput, SimulationResult, ValidSimulation,
} from "@/contracts";
import { DIRECTIONS } from "@/contracts";
import { explain, getCatalog, simulate } from "@/lib/client-api";

const STORAGE_KEY = "akim-five-hours:base-snapshot:v1";
const LABELS: Record<Direction, string> = {
  transport: "Транспорт", green: "Зелёная среда", social: "Социальная сфера",
  safety: "Безопасность", services: "Городские сервисы",
};
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const fmt = (value: number) => numberFormat.format(value);
const delta = (value: number) => (value > 0 ? "+" : "") + fmt(value);
type Snapshot = { plan: PlanInput; result: ValidSimulation; savedAt: string };
type StoredSnapshot = Snapshot & { modelVersion: string };

function key(plan: PlanInput) {
  return plan.modelVersion + ":" + [...plan.actionIds].sort().join(",");
}
function valid(result: SimulationResult): result is ValidSimulation {
  return result.valid && result.officialScore !== null && result.metrics !== null;
}
function ErrorBox({ children }: { children: string }) {
  return <div className="error-box" role="alert">{children}</div>;
}
function ScoreResult({
  result, catalog, explanation, explaining, explanationError, onExplain,
}: {
  result: ValidSimulation; catalog: Catalog; explanation: Explanation | null;
  explaining: boolean; explanationError: string | null; onExplain: () => void;
}) {
  return <>
    <div className="score-card">
      <div className="score-label">Astana Quality of Life Score</div>
      <div className="score-value">{fmt(result.officialScore)}</div>
      <p className="score-caption">Расчётный результат · изменение к базовой модели {delta(result.metrics.deltaFromBaseline)}</p>
    </div>
    <div className="metric-grid" aria-label="Показатели города">
      {DIRECTIONS.map((name) => <div className="metric-tile" key={name}>
        <div className="metric-top"><span>{LABELS[name]}</span><strong>{fmt(result.metrics.dimensions[name])}</strong></div>
        <div className="metric-track" aria-hidden="true"><span style={{ width: Math.max(0, Math.min(100, result.metrics.dimensions[name])) + "%" }} /></div>
      </div>)}
    </div>
    <div className="district-list" aria-label="Результаты по условным районам">
      {catalog.districts.map((district) => {
        const row = result.metrics.districts.find((entry) => entry.districtId === district.id);
        if (!row) return null;
        return <article className="district-card" key={district.id}>
          <div className="district-top">
            <div><strong>{district.name}</strong><div className="district-sub">Вес в модели {fmt(district.weight * 100)}%</div></div>
            <div className="district-score">{fmt(row.scoreAfter)} <span className="district-sub">{delta(row.scoreDelta)}</span></div>
          </div>
          <div className="district-track" aria-hidden="true"><span style={{ width: Math.max(0, Math.min(100, row.scoreAfter)) + "%" }} /></div>
        </article>;
      })}
    </div>
    <details className="details">
      <summary>Как считается результат</summary>
      <div className="details-body">
        <p>Показатели нормализованы: большее значение означает лучший результат. Эффекты выбранных мер применяются к базовым значениям районов и ограничиваются диапазоном 0–100.</p>
        <p>Показатели районов объединяются с весами из каталога. Горизонт модели — {catalog.config.horizonMonths} месяцев; задержка эффекта учитывается по правилам модели.</p>
        <p>Это демонстрационная формула на синтетических данных, а не официальная методика оценки города или прогноз реальных изменений.</p>
      </div>
    </details>
    <div className="explanation" aria-live="polite">
      <div className="explanation-head">
        <strong>Объяснение результата</strong>
        {explanation?.source === "template" ? <span className="template-label">Шаблонное объяснение</span> : null}
        {explanation?.source === "ai" ? <span className="template-label">Объяснение ИИ</span> : null}
      </div>
      {explaining ? <div className="loading-row"><span className="spinner" />Готовим пояснение…</div> : null}
      {explanationError ? <ErrorBox>{explanationError}</ErrorBox> : null}
      {explanation ? <>
        <p>{explanation.summary}</p>
        {explanation.observations.map((item, index) => <p key={item.actionIds.join("-") + "-" + index}>{item.text}</p>)}
        <p><strong>Компромисс:</strong> {explanation.tradeoff}</p>
        <p><strong>Ограничение:</strong> {explanation.limitation}</p>
      </> : null}
      {!explaining && !explanation && !explanationError ? <button className="button button-secondary button-small" onClick={onExplain}>Получить объяснение</button> : null}
    </div>
    <p className="disclaimer">{catalog.config.disclaimer}</p>
  </>;
}

export function SimulationDashboard() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Direction | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [baseSnapshot, setBaseSnapshot] = useState<Snapshot | null>(null);
  const [versionMismatch, setVersionMismatch] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const simulationRequest = useRef(0);
  const explanationRequest = useRef(0);

  useEffect(() => {
    let active = true;
    void getCatalog().then((response) => {
      if (!active) return;
      if (!response.ok) {
        setCatalogError(response.error.message);
        setCatalogLoading(false);
        return;
      }
      setCatalog(response.data);
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as StoredSnapshot;
          if (saved.modelVersion !== response.data.config.modelVersion) setVersionMismatch(saved.modelVersion);
          else {
            setBaseSnapshot({ plan: saved.plan, result: saved.result, savedAt: saved.savedAt });
            setSelectedIds(saved.plan.actionIds);
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setCatalogLoading(false);
    }).catch((error: unknown) => {
      if (active) {
        setCatalogError(error instanceof Error ? error.message : "Не удалось загрузить каталог.");
        setCatalogLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const actions = catalog?.actions ?? [];
  const actionMap = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const selectedActions = selectedIds.map((id) => actionMap.get(id)).filter((action): action is Action => Boolean(action));
  const totalCost = selectedActions.reduce((sum, action) => sum + action.cost, 0);
  const budgetLimit = catalog?.config.budgetLimit ?? 100;
  const remaining = budgetLimit - totalCost;
  const visibleActions = actions.filter((action) => filter === "all" || action.direction === filter);
  const currentPlan: PlanInput | null = catalog ? { modelVersion: catalog.config.modelVersion, actionIds: selectedIds } : null;
  const matchesSnapshot = Boolean(currentPlan && baseSnapshot && key(currentPlan) === key(baseSnapshot.plan));

  const invalidateDraft = useCallback(() => {
    simulationRequest.current += 1;
    explanationRequest.current += 1;
    setSimulation(null);
    setSimulationError(null);
    setSimulating(false);
    setExplanation(null);
    setExplanationError(null);
    setExplaining(false);
  }, []);

  const toggle = (action: Action) => {
    const selected = selectedIds.includes(action.id);
    if (!selected && selectedIds.length >= (catalog?.config.decisionsRequired ?? 5)) return;
    invalidateDraft();
    setSelectedIds((ids) => selected ? ids.filter((id) => id !== action.id) : [...ids, action.id]);
  };

  const loadDemo = () => {
    if (!catalog) return;
    invalidateDraft();
    setSelectedIds(catalog.demoPlan.actionIds);
    setVersionMismatch(null);
  };

  const runSimulation = async () => {
    if (!catalog || !currentPlan || simulating) return;
    invalidateDraft();
    const requestId = simulationRequest.current;
    const plan = { modelVersion: currentPlan.modelVersion, actionIds: [...currentPlan.actionIds] };
    setSimulating(true);
    const response = await simulate(plan).catch((error: unknown): ApiResponse<SimulationResult> => ({
      ok: false,
      error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : "Не удалось выполнить расчёт." },
    }));
    if (requestId !== simulationRequest.current || key(plan) !== key({ modelVersion: catalog.config.modelVersion, actionIds: selectedIds })) return;
    setSimulating(false);
    if (!response.ok) {
      setSimulationError(response.error.message);
      return;
    }
    setSimulation(response.data);
    if (!valid(response.data)) return;
    const snapshot = { plan, result: response.data, savedAt: new Date().toISOString() };
    setBaseSnapshot(snapshot);
    setVersionMismatch(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, modelVersion: plan.modelVersion } satisfies StoredSnapshot));
    } catch {
      setSimulationError("Результат рассчитан, но не удалось сохранить снимок в этом браузере.");
    }
  };

  const getExplanation = async () => {
    const hasCurrentResult = (simulation && valid(simulation)) || (matchesSnapshot && baseSnapshot !== null);
    if (!catalog || !currentPlan || !hasCurrentResult || explaining) return;
    explanationRequest.current += 1;
    const requestId = explanationRequest.current;
    const plan = { modelVersion: currentPlan.modelVersion, actionIds: [...currentPlan.actionIds] };
    setExplaining(true);
    setExplanation(null);
    setExplanationError(null);
    const response = await explain({ kind: "base", plan }).catch((error: unknown): ApiResponse<Explanation> => ({
      ok: false,
      error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : "Не удалось получить объяснение." },
    }));
    if (requestId !== explanationRequest.current) return;
    setExplaining(false);
    if (!response.ok) setExplanationError(response.error.message);
    else setExplanation(response.data);
  };

  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
  const required = catalog?.config.decisionsRequired ?? 5;

  if (catalogLoading) return <main className="app-shell"><div className="loading-surface"><div className="loading-row"><span className="spinner" />Загружаем каталог…</div></div></main>;
  if (catalogError || !catalog) return <main className="app-shell"><ErrorBox>{catalogError ?? "Каталог недоступен."}</ErrorBox></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark" aria-hidden="true">A.</div><div className="brand-copy"><strong>Аким на 5 часов</strong><span>Лаборатория городских решений</span></div></div>
      <div className="topbar-right">
        <span className={isMock ? "status-pill warning" : "status-pill success"}><span className="status-dot" aria-hidden="true" />{isMock ? "Демо-сценарии" : "Расчётный режим"}</span>
        <span className="model-pill">Модель {catalog.config.modelVersion}</span>
      </div>
    </header>

    <section className="hero" aria-labelledby="page-title">
      <div className="hero-main">
        <div className="eyebrow">Городской симулятор решений</div>
        <h1 id="page-title">Как изменится город от ваших решений?</h1>
        <p className="hero-copy">Соберите план из пяти мероприятий, распределите бюджет и изучите расчётный результат. Затем проверьте, как он изменится после события.</p>
        <div className="hero-tags"><span className="tag">{required} решений</span><span className="tag">{budgetLimit} условных единиц</span><span className="tag">{catalog.config.horizonMonths} месяцев</span><span className="tag">{catalog.config.dataMode === "synthetic" ? "Синтетические данные" : "Данные организатора"}</span></div>
      </div>
      <aside className="hero-side" aria-label="Состояние плана">
        <div>
          <div className="budget-top"><span>Бюджет плана</span><span>{remaining >= 0 ? "В пределах лимита" : "Лимит превышен"}</span></div>
          <div className="budget-value">{fmt(totalCost)} <small>/ {fmt(budgetLimit)}</small></div>
          <div className={"budget-track " + (remaining < 0 ? "over" : "")} role="progressbar" aria-label="Использовано бюджета" aria-valuemin={0} aria-valuemax={budgetLimit} aria-valuenow={Math.max(0, Math.min(budgetLimit, totalCost))}><span style={{ width: Math.max(0, Math.min(100, totalCost / budgetLimit * 100)) + "%" }} /></div>
          <div className="budget-foot"><span>Потрачено</span><span>Осталось {fmt(remaining)}</span></div>
        </div>
        <div className="side-divider" />
        <div className="picker-count"><strong>{selectedIds.length} / {required}</strong><span>{selectedIds.length === required ? "План готов к расчёту" : "Выберите ещё " + Math.max(0, required - selectedIds.length)}</span></div>
      </aside>
    </section>

    <div className="section-heading">
      <div><h2>Соберите городской план</h2><p>Можно выбирать меры разных или одинаковых направлений.</p></div>
      <div className="heading-actions">
        <button className="button button-secondary" type="button" onClick={loadDemo}>Загрузить демо-план</button>
        <button className="button button-primary" type="button" onClick={runSimulation} disabled={simulating || selectedIds.length === 0}>{simulating ? <><span className="spinner" />Считаем…</> : "Рассчитать результат"}</button>
      </div>
    </div>

    {versionMismatch ? <div className="notice-box" role="status">Сохранённый результат относится к версии {versionMismatch}, доступна версия {catalog.config.modelVersion}. Соберите план заново и пересчитайте его, чтобы не смешивать версии модели.</div> : null}
    {catalog.config.dataMode === "synthetic" ? <div className="notice-box" role="note">Районы и эффекты — учебные синтетические данные. Это не реальная статистика и не административные границы города.</div> : null}

    <div className="filter-row" role="group" aria-label="Фильтр мероприятий по направлению">
      {(["all", ...DIRECTIONS] as (Direction | "all")[]).map((item) => <button key={item} type="button" className={"filter-button " + (filter === item ? "active" : "")} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "Все направления" : LABELS[item]}</button>)}
    </div>

    <div className="content-grid">
      <section className="panel panel-pad" aria-labelledby="actions-heading">
        <div className="panel-title"><h3 id="actions-heading">Мероприятия</h3><span>{visibleActions.length} из {actions.length}</span></div>
        <div className="action-list">
          {visibleActions.map((action) => {
            const isSelected = selectedIds.includes(action.id);
            const eventOnly = action.availability.kind === "event";
            const disableCard = eventOnly || (!isSelected && selectedIds.length >= required);
            const effects = Object.entries(action.effects).flatMap(([districtId, metrics]) => Object.entries(metrics).map(([name, value]) => ({ districtId, name: name as Direction, value })));
            return <button className={"action-card " + (isSelected ? "selected" : "")} type="button" key={action.id} aria-pressed={isSelected} disabled={disableCard} onClick={() => toggle(action)}>
              <span className="action-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
              <div className="action-card-top"><h4>{action.title}</h4><span className="action-cost">{action.cost} ед.</span></div>
              <p className="action-desc">{action.description}</p>
              <div className="action-meta">
                <span className="mini-tag">{LABELS[action.direction]}</span>
                <span className="mini-tag">{action.lagMonths === 0 ? "Без задержки" : "Эффект через " + action.lagMonths + " мес."}</span>
                {effects.slice(0, 3).map((effect) => <span className="mini-tag" key={action.id + effect.districtId + effect.name}>{effect.districtId} · {LABELS[effect.name]} {delta(effect.value)}</span>)}
                {action.constraints.requires.length ? <span className="mini-tag alert">Требует: {action.constraints.requires.map((id) => actionMap.get(id)?.title ?? id).join(", ")}</span> : null}
                {action.constraints.excludes.length ? <span className="mini-tag alert">Несовместимо: {action.constraints.excludes.map((id) => actionMap.get(id)?.title ?? id).join(", ")}</span> : null}
                {eventOnly ? <span className="mini-tag alert">Откроется после события</span> : null}
              </div>
            </button>;
          })}
        </div>
        <div className="selection-summary">
          <div className="selection-head"><strong>Ваш выбор</strong><span>{selectedIds.length} / {required}</span></div>
          {selectedActions.length ? <div className="selection-chips">{selectedActions.map((action) => <span className="selection-chip" key={action.id}>{action.title}<button type="button" aria-label={"Убрать: " + action.title} onClick={() => toggle(action)}>×</button></span>)}</div> : <span className="empty-slot">Пока ничего не выбрано — начните с любой меры.</span>}
        </div>
      </section>

      <section className="panel panel-pad" aria-labelledby="result-heading">
        <div className="panel-title"><h3 id="result-heading">Результат плана</h3><span>{matchesSnapshot ? "Сохранённый снимок" : "Текущий выбор"}</span></div>
        {simulationError ? <ErrorBox>{simulationError}</ErrorBox> : null}
        {simulation && !valid(simulation) ? <>
          <div className="notice-box" role="status">Для результата нужно ровно пять мероприятий в пределах бюджета и без нарушений ограничений. Некорректный план не получает балл.</div>
          {simulation.errors.map((issue, index) => <p className="district-sub" key={issue.code + index}>{issue.message}</p>)}
        </> : null}
        {simulation && valid(simulation) && matchesSnapshot ? <ScoreResult result={simulation} catalog={catalog} explanation={explanation} explaining={explaining} explanationError={explanationError} onExplain={() => void getExplanation()} /> : null}
        {!simulation && matchesSnapshot && baseSnapshot ? <ScoreResult result={baseSnapshot.result} catalog={catalog} explanation={explanation} explaining={explaining} explanationError={explanationError} onExplain={() => void getExplanation()} /> : null}
        {!simulation && baseSnapshot && !matchesSnapshot ? <>
          <div className="notice-box" role="status">Выбор изменён. Сохранённый исходный результат останется неизменным, пока вы не пересчитаете план.</div>
          <div className="score-card" style={{ marginTop: 12 }}><div className="score-label">Неизменённый исходный снимок</div><div className="score-value">{fmt(baseSnapshot.result.officialScore)}</div><p className="score-caption">{fmt(baseSnapshot.result.totalCost)} из {budgetLimit} единиц · {baseSnapshot.plan.actionIds.map((id) => actionMap.get(id)?.title ?? id).join(" · ")}</p></div>
        </> : null}
        {!simulation && !baseSnapshot ? <div className="empty-result"><div className="empty-icon" aria-hidden="true">↗</div><h3>Сначала соберите план</h3><p>Выберите пять мероприятий и рассчитайте результат. Невалидный план не получает Score.</p></div> : null}
        {simulating ? <div className="loading-surface"><div className="loading-row"><span className="spinner" />Считаем выбранный план…</div></div> : null}
        <p className="disclaimer">{catalog.config.disclaimer}</p>
      </section>
    </div>
    <footer className="footer-note">Модель помогает исследовать компромиссы; баллы не являются официальной оценкой качества жизни города.</footer>
  </main>;
}
