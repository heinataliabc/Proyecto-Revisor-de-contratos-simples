import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const FILES = [
  "ley-820-2003.txt",
  "codigo-civil-compraventa.txt",
  "ley-1581-2012.txt",
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9áéíóúñü\s]/gi, " ");
}

function chunks(text, size = 1200) {
  const parts = text.split(/\n\s*\n/).filter(Boolean);
  const out = [];
  let current = "";
  for (const part of parts) {
    if ((current + "\n\n" + part).length > size && current) {
      out.push(current.trim());
      current = part;
    } else {
      current += (current ? "\n\n" : "") + part;
    }
  }
  if (current) out.push(current.trim());
  return out;
}

function retrieve(question) {
  const terms = [...new Set(normalize(question).split(/\s+/).filter((w) => w.length > 3))];
  const records = [];

  for (const file of FILES) {
    const filePath = path.join(process.cwd(), "corpus", file);
    const text = fs.readFileSync(filePath, "utf8");

    for (const fragment of chunks(text)) {
      const haystack = normalize(fragment);
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      if (/arrend|canon|deposit/.test(normalize(question)) && file.includes("820")) score += 3;
      if (/compr|vende|computador|mueble|precio|entreg/.test(normalize(question)) && file.includes("civil")) score += 3;
      if (/dato|personal|privacidad|autoriz/.test(normalize(question)) && file.includes("1581")) score += 3;
      records.push({ source: file, fragment, score });
    }
  }

  return records.sort((a, b) => b.score - a.score).slice(0, 4);
}

export async function POST(request) {
  try {
    const { question } = await request.json();
    if (!question || !question.trim()) {
      return Response.json({ error: "Escribe una consulta." }, { status: 400 });
    }

    const rawApiKey = process.env.OPENROUTER_API_KEY || "";
    const apiKey = rawApiKey
      .trim()
      .replace(/^OPENROUTER_API_KEY\s*=\s*/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!apiKey) {
      return Response.json(
        { error: "La aplicación aún no tiene configurada la clave de OpenRouter en Vercel." },
        { status: 500 }
      );
    }

    if (!apiKey.startsWith("sk-or-")) {
      return Response.json(
        {
          error:
            "La variable OPENROUTER_API_KEY existe, pero su valor no parece ser una clave válida de OpenRouter. En Vercel pega únicamente la clave que empieza por sk-or-, sin escribir OPENROUTER_API_KEY= y sin comillas."
        },
        { status: 500 }
      );
    }

    const selected = retrieve(question);
    const context = selected
      .map((x) => `FUENTE: ${x.source}\nFRAGMENTO:\n${x.fragment}`)
      .join("\n\n---\n\n");

    const system = `Eres ContratoClaro, un asistente jurídico académico creado por Heilyn Natalia Barco Caicedo para el curso Derecho e Inteligencia Artificial de la Pontificia Universidad Javeriana.

ALCANCE: solo analizas arrendamiento de vivienda urbana y compraventa sencilla de bienes muebles entre particulares. No resuelvas asuntos laborales, societarios, comerciales complejos ni compraventa de inmuebles.

REGLAS:
- Responde en español claro.
- Responde únicamente con base en el contexto normativo recuperado.
- Cita la norma y el artículo cuando aparezcan en el contexto.
- Nunca inventes normas, artículos, sentencias ni consecuencias jurídicas.
- Si la información no basta, di: "No lo sé con certeza con la información disponible."
- No decidas definitivamente si el usuario debe firmar o no.
- Si está fuera del alcance, indícalo y recomienda revisión profesional.
- Termina SIEMPRE con: "Esta herramienta es un ejercicio académico que no constituye asesoría legal ni sustituye la consulta con un abogado."

ESTRUCTURA:
1. Qué dice.
2. Qué significa.
3. Riesgo o aspecto a revisar.
4. Base jurídica.
5. Qué puede hacer el usuario.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "ContratoClaro",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `CONTEXTO NORMATIVO:\n${context}\n\nCONSULTA:\n${question}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data?.error?.message || "OpenRouter devolvió un error." },
        { status: response.status }
      );
    }

    return Response.json({
      answer: data?.choices?.[0]?.message?.content || "No se obtuvo respuesta.",
      sources: selected.map(({ source, fragment }) => ({
        source,
        fragment: fragment.slice(0, 900),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: "No fue posible procesar la consulta.", detail: String(error) },
      { status: 500 }
    );
  }
}
