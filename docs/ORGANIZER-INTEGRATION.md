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
