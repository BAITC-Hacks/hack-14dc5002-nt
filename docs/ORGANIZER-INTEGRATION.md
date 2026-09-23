# Интеграция участника 3: organizer-v1

## Источник и границы миграции

Движок, данные и тесты импортированы из ветки Nikita, commit `8a7b6be`.
Формула не изменена. Механический патч для Никиты: в пяти файлах
`src/lib/simulation/*.ts` импорт `../../contracts/index.ts` заменён на
`../../contracts/organizer.ts`. Каталог сохранён в `src/data/organizer-catalog.json`;
его путь соответственно изменён в импортированных тестах. Это позволяет
сохранить существующий интерфейс Сембы и fixtures demo-v1 до его миграции.

- `src/contracts/index.ts`, `src/data/catalog.json`, старые mocks: только прежнее demo-v1.
- `src/contracts/organizer.ts`: исходный контракт расчёта Никиты.
- `src/contracts/organizer-api.ts`: контракт живого HTTP API, включая реальные типы событий.
- `GET /api/catalog` всегда возвращает organizer-v1 и отдельный `teamEvents`.
- `POST /api/simulate` принимает `{modelVersion, selections:[{actionId,districtId?}]}`.
- `src/lib/client-api.ts` сохраняет старое mock-демо; при новом каталоге в реальном
  режиме возвращает `UI_CONTRACT_OUTDATED`, чтобы старый UI не показал неверные данные.

Не объединяйте всю ветку Nikita поверх Semba: она заменяет старые контракты и mocks.
Изменения требований отражены здесь отдельно; старые BRIEF/CONTRACT описывают demo-v1.
Источник формулы и допущений organizer-v1: `docs/MODEL.md`, `docs/DATASET.md`.

## Проверки первого этапа

`npm run typecheck` прошёл. API тестирует эталонный Score `56.54307`, стоимость `95`,
произвольный план, состояния 4/6, запрет присланных цен/Score и несовместимую версию.
`npm test` запускает отдельно Vitest API и оригинальные Node-тесты движка.

Общий ответ: `{ok:true,data}` или `{ok:false,error:{code,message,issues?}}`.
400 — некорректная форма; 409 — версия; 422 — недопустимый переход события;
500 — обезличенная ошибка. Невалидный бизнес-план имеет HTTP 200, `valid:false`,
`officialScore:null`, `metrics:null`; такие результаты нельзя отображать как нулевой Score.

## События и подключение интерфейса

Живые `POST /api/events/preview` и `/api/events/confirm` подключены к `simulation/events.ts`.
Вызовы из `simulation/index.ts` намеренно оставлены заглушками Никиты и не используются HTTP API.

Сценарии выбирает пользователь учебного симулятора: они не случайные серверные задания.
Подтверждение stateless: сервер снова проверяет исходную пятёрку, событие, ID замены и район.
Поэтому preview не является разрешением на выполнение; сервер не доверяет присланным числам.
Цепочки событий и частичный возврат бюджета здесь не реализованы.

Для Сембы:

1. Перейти с `@/contracts` на `@/contracts/organizer-api`, с `@/lib/client-api` на
   `@/lib/organizer-api`. Старый интерфейс до миграции работает только в mock=true.
2. Выбирать `districtId` для `scope:district`; для `scope:city` не передавать район.
   План хранить как `selections`, а не только `actionIds`. Старый localStorage не мигрировать
   молча — предложить пользователю собрать план заново.
3. Отображать `horizonQuarters`, `metrics.indicators`, `metrics.directions`, `populationWeight`;
   направление озеленения теперь `ecology`. Все данные синтетические.
4. Читать сценарии из `catalog.teamEvents`, поскольку организаторский `catalog.events` пуст.
5. Для отмены отправить `eventId:cancel-action`, `eventVersion:team-events-v2`,
   `cancelledActionId`. Preview содержит `draftResult` без Score, `refundAmount`, `availableBudget`.
6. Для подтверждения добавить `removedActionId`, `addedActionId`, и
   `addedDistrictId:option.addedSelection.districtId` (если район задан).
7. Для обязательной меры: `eventId:require-action`, `eventVersion:team-events-v3`,
   `requiredActionId`. Это обязательная существующая мера, а не разблокировка новой.
   Обработать `already-satisfied`, `replacement-required`, `no-valid-replacement`.
   Общего `draftResult` здесь нет; бюджет указан у каждого варианта отдельно.

Новый клиент поддерживает AbortSignal; при смене плана отменять старый запрос.
Mock=true использует только явные `src/mocks/organizer/scenarios.json` с клонированием ответов;
несовпадение района/версии/ID возвращает `MOCK_SCENARIO_NOT_DEFINED`.
В mock=false запросы идут в HTTP API и считаются движком, а не fixtures.
Для обновления расчетных fixtures: `node --experimental-strip-types verification/generate-organizer-mocks.mjs`.
