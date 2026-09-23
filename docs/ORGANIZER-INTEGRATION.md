# Интеграция участника 3: organizer-v1

## Источник и границы миграции

Движок, данные и тесты импортированы из ветки Nikita, commit `8a7b6be2db8b3a5b2c5da26ac418c3dcd2a40260`.
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

## Объяснения RU/KK/EN

`POST /api/explain`: `{kind:"base",plan,language:"ru"|"kk"|"en"}` либо
`{kind:"event",change,language}`. Язык по умолчанию `ru`, код казахского — `kk`.
Сервер пересчитывает результат. Для четвёрки, недопустимой замены или устаревшей
версии объяснение не создаётся. Ответ содержит `source`, `language`, `summary`,
`observations` с ID мер/районов, `tradeoff`, `limitation`.

Сначала создаются проверенные локализованные факты из trace и результатов движка.
OpenAI через Responses API Structured Outputs выбирает 2–5 ID фактов и их порядок.
Произвольный текст модели не выводится: все фразы, числа и ссылки на мероприятия
формирует сервер. `source:ai` означает участие модели в выборе фактов — это прямо
объясняется в поле limitation. Числовые карточки UI всегда используют сам результат движка.
Это контролируемый AI-помощник, не свободный чат и не генератор новой формулы.
Формат SDK сверен с [официальной документацией](https://developers.openai.com/api/docs/guides/structured-outputs).

Без ключа/модели/доступа, при AI_ENABLED=false, отказе, неизвестных ID,
ошибке или таймауте — `source:template`. SDK создаётся лениво, повторные запросы
выключены, `store:false`, максимум 500 выходных токенов, timeout не больше 12 секунд.
Отмена запроса отменяет вызов SDK. Кэш 5 минут/100 записей учитывает модель, язык,
версию промпта, каталог, горизонт и канонический план/событие.

Защита одного процесса: максимум 2 одновременных вызова, 6 попыток за минуту,
100 попыток за время жизни процесса; превышение возвращает template. Это не общий
бюджет для serverless — при публичном размещении нужен собственный серверный доступ.
Ключ OpenAI и `EXPLAIN_AI_ACCESS_TOKEN` никогда не передавать браузеру или Сембе.

### Локальный запуск с AI

Сохрани существующие секреты в игнорируемом `.env.local`. Для обычной автономной
разработки оставь `AI_ENABLED=false`. Для проверки модели локально:

```dotenv
AI_ENABLED=true
AI_LOCAL_DEMO=true
AI_TIMEOUT_MS=12000
# OPENAI_API_KEY и OPENAI_MODEL уже задаются приватно на сервере.
```

```sh
npm run dev:local
```

Этот режим разрешён только при development и привязке сервера к `127.0.0.1`.
Запрос должен быть JSON; чужой Origin не разрешает платный вызов.
В production `AI_LOCAL_DEMO` игнорируется. Платный доступ там возможен только
с серверным `Authorization: Bearer <EXPLAIN_AI_ACCESS_TOKEN>` через защищённый gateway.
Обычный браузер без такой интеграции получает template. Токен не добавлять в client-api.
Для публичного MVP безопасный рабочий режим — AI_ENABLED=false до подключения доступа.

### Пример полного пути из PowerShell

Работает с запущенным `npm run dev:local`, ключ не нужен для шаблонов:

```powershell
$apiBase = 'http://127.0.0.1:3000'
function Post-Akim($path, $payload) {
  Invoke-RestMethod -Uri ($apiBase + $path) -Method Post -ContentType 'application/json; charset=utf-8' -Body ($payload | ConvertTo-Json -Depth 20)
}
$catalog = (Invoke-RestMethod "$apiBase/api/catalog").data
$base = Post-Akim '/api/simulate' $catalog.demoPlan
$event = @{ basePlan = $catalog.demoPlan; eventId = 'cancel-action'; eventVersion = 'team-events-v2'; cancelledActionId = 'M7' }
$preview = Post-Akim '/api/events/preview' $event
$option = $preview.data.replacementOptions[0]
$change = $event.Clone()
$change.removedActionId = $option.removedActionId
$change.addedActionId = $option.addedActionId
if ($option.addedSelection.districtId) { $change.addedDistrictId = $option.addedSelection.districtId }
$confirmed = Post-Akim '/api/events/confirm' $change
$explanation = Post-Akim '/api/explain' @{ kind = 'event'; change = $change; language = 'kk' }
$base.data.officialScore
$confirmed.data.comparison
$explanation.data
```

### Команды приёмки

```sh
npm run typecheck
npm run lint
npm test
npm run test:api:e2e
npm run build
```

HTTP-тесты запускают отдельный локальный сервер на 3318 с mock=false и пустым
ключом, проверяют произвольный план, отмену и обязательную меру, подтверждение,
все языки и недопустимые запросы. Браузерные `npm run test:e2e` отдельно проверяют
сохранённый старый UI в mock=true. Не запускай эти серверы и build одновременно.
Все JSON-входы строгие и ограничены 32 КиБ фактического тела запроса.
