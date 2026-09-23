import type { Catalog, Comparison, ValidSimulation } from "@/contracts/organizer";
import type { EventConfirmInput, Explanation, Language } from "@/contracts/organizer-api";

type Observation = Explanation["observations"][number];
export interface ExplanationFact extends Observation { id: string }
export interface ExplanationContext {
  catalog: Catalog;
  result: ValidSimulation;
  base?: ValidSimulation;
  comparison?: Comparison;
  change?: EventConfirmInput;
}

const locales = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" } as const;
const districtNames: Record<Language, Record<string, string>> = {
  ru: { esil: "Есиль", almaty: "Алматы", saryarka: "Сарыарка", baikonur: "Байконур", nura: "Нура" },
  kk: { esil: "Есіл", almaty: "Алматы", saryarka: "Сарыарқа", baikonur: "Байқоңыр", nura: "Нұра" },
  en: { esil: "Esil", almaty: "Almaty", saryarka: "Saryarka", baikonur: "Baikonur", nura: "Nura" },
};
const copy = {
  ru: {
    city: "все районы модели", noEffects: "нет применённых эффектов", indicators: "изменения показателей до ограничения диапазона",
    summary: (score: string, delta: string, cost: string, remaining: string, horizon: number) =>
      `План из пяти мероприятий: Score ${score}, изменение к исходным условиям ${delta}. Расход ${cost}, остаток ${remaining}; горизонт — ${horizon} кварталов.`,
    event: (before: string, after: string, delta: string) => `Подтверждённая замена: Score ${before} → ${after}, разница ${delta}. Исходный план сохранён отдельно.`,
    action: (id: string, target: string, lag: number, multiplier: string, effects: string) =>
      `${id} — ${target}. Лаг: ${lag} кварталов; учтённая доля эффекта: ${multiplier}. ${effects}.`,
    district: (name: string, delta: string) => `${name}: изменение районного Score к исходным условиям ${delta}.`,
    removed: (text: string) => `Удалённая мера в сохранённом исходном плане: ${text} Эти эффекты больше не применяются в новой ветке.`,
    eventDistrict: (name: string, delta: string, effects: string) => `${name}: изменение районного Score относительно сохранённого исходного плана ${delta}. Изменения итоговых показателей: ${effects || "нет"}.`,
    lostSynergy: (text: string) => `В сохранённом исходном плане: ${text} После замены эта синергия утрачена.`,
    newSynergy: (text: string) => `После замены появилась новая синергия: ${text}`,
    swap: (removed: string, added: string, cost: string, remaining: string) =>
      `${removed} заменено на ${added}. Расход нового плана ${cost}, остаток ${remaining}. Пересмотр до начала исполнения предполагает полный возврат стоимости удалённой меры.`,
    synergy: (ids: string, district: string, indicator: string, bonus: string) => `${ids}: учтена синергия в районе ${district}, ${indicator} ${bonus} до ограничения диапазона.`,
    tradeoff: "Score учитывает средневзвешенные показатели, самый слабый район и критически низкие значения. Улучшение одного района не означает одинаковый эффект во всех районах; вклады мер до ограничения диапазона не равны их отдельному вкладу в итоговый Score.",
    limitation: "Учебная модель на синтетических данных, не официальная статистика и не прогноз Астаны. Все числа и допустимые замены рассчитаны движком.",
    aiNote: " AI только выбирает и упорядочивает проверенные сервером факты; текст и числа сформированы шаблонами.",
  },
  kk: {
    city: "модельдегі барлық аудан", noEffects: "қолданылған әсерлер жоқ", indicators: "диапазон шектеуіне дейінгі көрсеткіш өзгерістері",
    summary: (score: string, delta: string, cost: string, remaining: string, horizon: number) =>
      `Бес шарадан тұратын жоспар: Score ${score}, бастапқы жағдаймен салыстырғандағы өзгеріс ${delta}. Шығын ${cost}, қалдық ${remaining}; есеп көкжиегі — ${horizon} тоқсан.`,
    event: (before: string, after: string, delta: string) => `Расталған ауыстыру: Score ${before} → ${after}, айырмасы ${delta}. Бастапқы жоспар бөлек сақталған.`,
    action: (id: string, target: string, lag: number, multiplier: string, effects: string) =>
      `${id} — ${target}. Кідіріс: ${lag} тоқсан; есепке алынған әсер үлесі: ${multiplier}. ${effects}.`,
    district: (name: string, delta: string) => `${name}: аудандық Score көрсеткішінің бастапқы жағдайдан өзгерісі ${delta}.`,
    removed: (text: string) => `Сақталған бастапқы жоспардағы алып тасталған шара: ${text} Бұл әсерлер жаңа тармақта енді қолданылмайды.`,
    eventDistrict: (name: string, delta: string, effects: string) => `${name}: сақталған бастапқы жоспармен салыстырғандағы аудандық Score өзгерісі ${delta}. Соңғы көрсеткіштердің өзгерістері: ${effects || "жоқ"}.`,
    lostSynergy: (text: string) => `Сақталған бастапқы жоспарда: ${text} Ауыстырудан кейін бұл синергия жоғалды.`,
    newSynergy: (text: string) => `Ауыстырудан кейін жаңа синергия пайда болды: ${text}`,
    swap: (removed: string, added: string, cost: string, remaining: string) =>
      `${removed} шарасы ${added} шарасына ауыстырылды. Жаңа жоспардың шығыны ${cost}, қалдығы ${remaining}. Орындау басталғанға дейінгі қайта қарау жойылған шара құнының толық қайтарылуын болжайды.`,
    synergy: (ids: string, district: string, indicator: string, bonus: string) => `${ids}: ${district} ауданында синергия есепке алынды, диапазон шектеуіне дейін ${indicator} ${bonus}.`,
    tradeoff: "Score өлшенген орташа көрсеткіштерді, ең әлсіз ауданды және өте төмен мәндерді ескереді. Бір ауданның жақсаруы барлық ауданда бірдей әсер болады дегенді білдірмейді; диапазон шектеуіне дейінгі әсерлер соңғы Score-ға жеке үлес болып саналмайды.",
    limitation: "Синтетикалық деректерге негізделген оқу моделі; Астананың ресми статистикасы немесе болжамы емес. Барлық сандар мен рұқсат етілген ауыстыруларды есептеу қозғалтқышы анықтайды.",
    aiNote: " AI тек сервер тексерген фактілерді таңдап, реттейді; мәтін мен сандар үлгілер арқылы жасалады.",
  },
  en: {
    city: "all model districts", noEffects: "no applied effects", indicators: "indicator changes before range clipping",
    summary: (score: string, delta: string, cost: string, remaining: string, horizon: number) =>
      `Five-action plan: Score ${score}, change from baseline ${delta}. Cost ${cost}, budget remaining ${remaining}; horizon: ${horizon} quarters.`,
    event: (before: string, after: string, delta: string) => `Confirmed replacement: Score ${before} → ${after}, change ${delta}. The original plan remains separate.`,
    action: (id: string, target: string, lag: number, multiplier: string, effects: string) =>
      `${id} — ${target}. Lag: ${lag} quarters; applied effect multiplier: ${multiplier}. ${effects}.`,
    district: (name: string, delta: string) => `${name}: district Score change from baseline ${delta}.`,
    removed: (text: string) => `Removed action in the saved original plan: ${text} These effects no longer apply in the new branch.`,
    eventDistrict: (name: string, delta: string, effects: string) => `${name}: district Score change relative to the saved original plan ${delta}. Final indicator changes: ${effects || "none"}.`,
    lostSynergy: (text: string) => `In the saved original plan: ${text} This synergy was lost after the replacement.`,
    newSynergy: (text: string) => `New synergy after the replacement: ${text}`,
    swap: (removed: string, added: string, cost: string, remaining: string) =>
      `${removed} replaced by ${added}. New plan cost ${cost}, budget remaining ${remaining}. Revising the plan before implementation assumes a full refund of the removed action.`,
    synergy: (ids: string, district: string, indicator: string, bonus: string) => `${ids}: applied synergy in ${district}, ${indicator} ${bonus} before range clipping.`,
    tradeoff: "Score includes population-weighted indicators, the weakest district and critically low values. An improvement in one district does not imply equal effects everywhere; raw action effects before range clipping are not individual contributions to the final Score.",
    limitation: "An educational model using synthetic data, not official statistics or a forecast for Astana. The engine calculates all numbers and valid replacements.",
    aiNote: " AI only selects and orders server-verified facts; templates produce all wording and numbers.",
  },
};

/** Formatting never replaces the engine's full-precision result used by numeric UI cards. */
export function buildExplanation(context: ExplanationContext, language: Language) {
  const { catalog, result, base, comparison, change } = context;
  const words = copy[language];
  const number = (value: number) => new Intl.NumberFormat(locales[language], { maximumFractionDigits: 3 }).format(value);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
  const districtName = (id: string) => districtNames[language][id] ?? id;
  const effectList = (effects: Record<string, number | undefined>) => Object.entries(effects)
    .filter((entry): entry is [string, number] => entry[1] !== undefined && entry[1] !== 0)
    .sort(([a], [b]) => a.localeCompare(b)).map(([indicator, value]) => `${indicator} ${signed(value)}`).join(", ");
  const traceText = (trace: ValidSimulation["trace"][number]) => {
    const effects = effectList(trace.appliedEffects);
    return words.action(trace.actionId, trace.districtId ? districtName(trace.districtId) : words.city,
      trace.lagQuarters, number(trace.effectMultiplier), effects ? `${words.indicators}: ${effects}` : words.noEffects);
  };
  const facts: ExplanationFact[] = [];
  if (change) {
    const districtIds = [...new Set([base, result].flatMap((simulation) => simulation?.plan.selections
      .filter((selection) => [change.removedActionId, change.addedActionId].includes(selection.actionId))
      .flatMap((selection) => selection.districtId ? [selection.districtId] : []) ?? []))];
    facts.push({
      id: "confirmed-swap", actionIds: [change.removedActionId, change.addedActionId], districtIds,
      text: words.swap(change.removedActionId, change.addedActionId, number(result.totalCost), number(result.remainingBudget)),
    });
  }
  const orderedTrace = change ? [...result.trace].sort((a, b) =>
    Number(b.actionId === change.addedActionId) - Number(a.actionId === change.addedActionId)) : result.trace;
  for (const trace of orderedTrace) {
    const districtIds = trace.districtId ? [trace.districtId] : catalog.districts.map((district) => district.id);
    facts.push({
      id: `action:${trace.actionId}`, actionIds: [trace.actionId], districtIds,
      text: traceText(trace),
    });
  }
  const eventDistrictFacts: ExplanationFact[] = [];
  const changedSynergyFacts: ExplanationFact[] = [];
  if (change && base && comparison) {
    const removed = base.trace.find((trace) => trace.actionId === change.removedActionId);
    if (removed) facts.push({
      id: `removed-action:${removed.actionId}`, actionIds: [removed.actionId],
      districtIds: removed.districtId ? [removed.districtId] : catalog.districts.map((district) => district.id),
      text: words.removed(traceText(removed)),
    });
    // These deltas compare two valid saved plans, not the new plan to the raw baseline.
    for (const district of [...comparison.districts].sort((a, b) =>
      Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta) || a.districtId.localeCompare(b.districtId))) {
      eventDistrictFacts.push({
        id: `event-district:${district.districtId}`, actionIds: [], districtIds: [district.districtId],
        text: words.eventDistrict(districtName(district.districtId), signed(district.scoreDelta), effectList(district.indicatorsDelta)),
      });
    }
    type Synergy = ValidSimulation["metrics"]["synergiesApplied"][number];
    const synergyKey = (synergy: Synergy) => JSON.stringify([
      [...synergy.actionIds].sort(), synergy.districtId, synergy.indicator, synergy.bonus,
    ]);
    const oldKeys = new Set(base.metrics.synergiesApplied.map(synergyKey));
    const newKeys = new Set(result.metrics.synergiesApplied.map(synergyKey));
    const changedSynergies = [
      ...base.metrics.synergiesApplied.filter((synergy) => !newKeys.has(synergyKey(synergy)))
        .map((synergy) => ({ synergy, kind: "lost" as const })),
      ...result.metrics.synergiesApplied.filter((synergy) => !oldKeys.has(synergyKey(synergy)))
        .map((synergy) => ({ synergy, kind: "new" as const })),
    ];
    for (const [index, { synergy, kind }] of changedSynergies.entries()) {
      const text = words.synergy(synergy.actionIds.join(" + "), districtName(synergy.districtId), synergy.indicator, signed(synergy.bonus));
      changedSynergyFacts.push({
        id: `${kind}-synergy:${index}`, actionIds: [...synergy.actionIds], districtIds: [synergy.districtId],
        text: kind === "lost" ? words.lostSynergy(text) : words.newSynergy(text),
      });
    }
    facts.push(...eventDistrictFacts, ...changedSynergyFacts);
  }
  for (const [index, synergy] of result.metrics.synergiesApplied.entries()) {
    facts.push({
      id: `synergy:${index}`, actionIds: [...synergy.actionIds], districtIds: [synergy.districtId],
      text: words.synergy(synergy.actionIds.join(" + "), districtName(synergy.districtId), synergy.indicator, signed(synergy.bonus)),
    });
  }
  for (const district of result.metrics.districts) {
    facts.push({ id: `district:${district.districtId}`, actionIds: [], districtIds: [district.districtId],
      text: words.district(districtName(district.districtId), signed(district.scoreDelta)) });
  }
  const selectedFacts = change && base && comparison ? [
    facts.find((fact) => fact.id === "confirmed-swap"),
    facts.find((fact) => fact.id === `action:${change.addedActionId}`),
    facts.find((fact) => fact.id === `removed-action:${change.removedActionId}`),
    eventDistrictFacts[0],
    changedSynergyFacts[0],
  ].filter((fact): fact is ExplanationFact => fact !== undefined) : facts.slice(0, 5);
  const template: Explanation = {
    source: "template", language,
    summary: base && comparison ? words.event(number(base.officialScore), number(result.officialScore), signed(comparison.scoreDelta))
      : words.summary(number(result.officialScore), signed(result.metrics.deltaFromBaseline), number(result.totalCost), number(result.remainingBudget), catalog.config.horizonQuarters),
    observations: selectedFacts.map(({ actionIds, districtIds, text }) => ({ actionIds, districtIds, text })),
    tradeoff: words.tradeoff, limitation: words.limitation,
  };
  return { facts, template, aiLimitation: words.limitation + words.aiNote };
}
