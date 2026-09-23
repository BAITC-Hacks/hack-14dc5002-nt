# Технические первоисточники

Проверены 23 сентября 2026 года. Они подтверждают возможности инструментов, но не являются источником требований хакатона или демонстрационных чисел.

- Codex: AGENTS.md читается до работы над задачей. https://developers.openai.com/codex/guides/agents-md (официальное перенаправление на learn.chatgpt.com).
- Codex / Git worktrees: отдельные рабочие деревья и запрет одновременного checkout одной ветки в нескольких деревьях. https://developers.openai.com/codex/app/worktrees
- Next.js: установка App Router, TypeScript, Tailwind и минимальные требования окружения. https://nextjs.org/docs/app/getting-started/installation
- Next.js: серверные route handlers в приложении. https://nextjs.org/docs/app/getting-started/route-handlers
- OpenAI: Structured Outputs / Responses API, схема и обработка отказов. https://platform.openai.com/docs/guides/structured-outputs
- OpenAI: ключ нельзя размещать в браузере или коммитить в репозиторий. https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

Конкретная AI-модель и версии npm-пакетов не зафиксированы без проверки окружения команды. Их выбирает интегратор при bootstrap/первом доступном API-вызове, затем фиксирует lockfile и серверную OPENAI_MODEL.
