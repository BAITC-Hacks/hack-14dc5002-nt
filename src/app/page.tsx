export default function Home() {
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  return (
    <main className="shell">
      <p className="eyebrow">Аким на 5 часов</p>
      <h1>Симулятор городских решений</h1>
      <p className="description">
        Учебная модель на синтетических данных. Выберите пять мероприятий и распределите условный бюджет.
      </p>
      {mockMode && <p className="mock-badge" role="status">Демо: mock-ответы</p>}
    </main>
  );
}
