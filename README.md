# «Аким на 5 часов» — детерминированная модель organizer-v1

В этом репозитории находятся исходный синтетический каталог хакатона, TypeScript контракт и детерминированный расчет. Готового Next.js интерфейса и HTTP API пока нет.

## Модель

Пользователь выбирает пять уникальных мер в бюджете 100. Для районных мер указывается район; городские применяются ко всем пяти районам. Допускается не более двух мер направления. Лаг масштабирует эффект по формуле `(8 − лаг) / 8`; применяются заданные синергии и несовместимости. Итоговый Score использует средний по населению балл, худший район и штраф за показатели ниже 40.

Исходные данные и формула: [docs/DATASET.md](docs/DATASET.md). Точное описание расчетных границ: [docs/MODEL.md](docs/MODEL.md). Контракт интеграции: [docs/CONTRACT.md](docs/CONTRACT.md).

## Контрольные значения

Baseline Score: `52.55768`. План `M7/Нура + M8/Нура + M10/Нура + M12/город + M5/Сарыарка` стоит `95`, использует синергию M10+M12 в Нуре и дает `56.54307` (UI отображает `56.5`).

## Локальные проверки

Требуется Node.js с поддержкой strip types (Node 24):

```sh
node --experimental-strip-types --test tests/simulation/engine.test.mjs
node --experimental-strip-types verification/check-fixtures.mjs
```

Полная проверка TypeScript:

```sh
npm exec --yes --package typescript@5.9.3 -- tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions src/lib/simulation/index.ts src/contracts/index.ts
```

Событий в переданном каталоге нет; event preview/confirm честно возвращают `EVENTS_NOT_CONFIGURED`. Все данные синтетические и не являются официальной статистикой или прогнозом.
