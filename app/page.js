"use client";

import { useState } from "react";

const examples = [
  "Mi contrato de arrendamiento dice que el canon puede subir en cualquier momento. ¿Qué debería revisar?",
  "Voy a comprar un computador usado y el contrato no dice cuándo se entrega. ¿Qué debería revisar?",
  "¿Puedes revisar una compraventa de un apartamento?"
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e?.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No fue posible realizar la revisión.");

      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="badge">Proyecto académico · Derecho e Inteligencia Artificial</div>
        <h1>⚖️ ContratoClaro</h1>
        <p className="tagline">Entiende las cláusulas antes de firmar.</p>
        <p className="intro">
          Revisión preliminar de contratos de arrendamiento de vivienda urbana y
          compraventa sencilla de bienes muebles entre particulares.
        </p>
      </section>

      <section className="warning">
        <strong>Advertencia:</strong> Esta herramienta es un ejercicio académico que no
        constituye asesoría legal ni sustituye la consulta con un abogado.
      </section>

      <section className="card">
        <form onSubmit={submit}>
          <label htmlFor="question">Escribe tu consulta o pega una cláusula</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ejemplo: Mi contrato dice que el canon puede aumentar en cualquier momento. ¿Qué debería revisar?"
            rows={8}
          />
          <button disabled={loading || !question.trim()} type="submit">
            {loading ? "Revisando el corpus..." : "Revisar contrato"}
          </button>
        </form>

        <div className="examples">
          <span>Prueba rápida:</span>
          {examples.map((item) => (
            <button key={item} className="example" onClick={() => setQuestion(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {error && <section className="error">{error}</section>}

      {answer && (
        <section className="card result">
          <h2>Resultado</h2>
          <div className="answer">{answer}</div>
          {sources.length > 0 && (
            <details>
              <summary>Fuentes recuperadas del corpus</summary>
              <div className="sources">
                {sources.map((s, i) => (
                  <div className="source" key={i}>
                    <strong>{s.source}</strong>
                    <pre>{s.fragment}</pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      <footer>
        Heilyn Natalia Barco Caicedo · Pontificia Universidad Javeriana · 2026-II
      </footer>
    </main>
  );
}
