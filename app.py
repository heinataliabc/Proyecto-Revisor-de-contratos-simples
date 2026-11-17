import os
from pathlib import Path

import requests
import streamlit as st
from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


load_dotenv()

CORPUS_DIR = Path("corpus")
DB_DIR = Path("db")
PROMPT_FILE = Path("prompt-sistema-v1.md")
DEFAULT_MODEL = "openrouter/free"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def obtener_secreto(nombre, default=None):
    valor = os.getenv(nombre)
    if valor:
        return valor

    try:
        if nombre in st.secrets:
            return st.secrets[nombre]
    except Exception:
        pass

    return default


@st.cache_resource
def cargar_o_construir_indice():
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    if DB_DIR.exists():
        try:
            return FAISS.load_local(
                str(DB_DIR),
                embeddings,
                allow_dangerous_deserialization=True,
            )
        except Exception:
            pass

    documentos = []
    for archivo in CORPUS_DIR.glob("*.txt"):
        contenido = archivo.read_text(encoding="utf-8").strip()
        if contenido:
            documentos.append(
                Document(
                    page_content=contenido,
                    metadata={"source": archivo.name},
                )
            )

    if not documentos:
        raise RuntimeError("No se encontraron archivos .txt con contenido en corpus/.")

    divisor = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
    )
    fragmentos = divisor.split_documents(documentos)

    return FAISS.from_documents(fragmentos, embeddings)


def cargar_prompt():
    if PROMPT_FILE.exists():
        return PROMPT_FILE.read_text(encoding="utf-8")

    return (
        "Eres ContratoClaro, un asistente jurídico académico. "
        "Responde únicamente con base en el contexto normativo entregado."
    )


def buscar_contexto(pregunta):
    indice = cargar_o_construir_indice()
    documentos = indice.similarity_search(pregunta, k=4)

    contexto = []
    for documento in documentos:
        fuente = documento.metadata.get("source", "fuente no identificada")
        contexto.append(
            f"FUENTE: {fuente}\nFRAGMENTO:\n{documento.page_content}"
        )

    return documentos, "\n\n---\n\n".join(contexto)


def consultar_openrouter(pregunta, contexto):
    api_key = obtener_secreto("OPENROUTER_API_KEY")
    modelo = obtener_secreto("OPENROUTER_MODEL", DEFAULT_MODEL)

    if not api_key:
        raise RuntimeError(
            "Falta OPENROUTER_API_KEY. Configúrala como secreto de Streamlit "
            "o variable de entorno local."
        )

    prompt_base = cargar_prompt()

    regla_rag = """
REGLA RAG OBLIGATORIA:
- Responde ÚNICAMENTE con base en el CONTEXTO NORMATIVO entregado abajo.
- Toda afirmación jurídica debe indicar la norma y, cuando aparezca en el contexto, el artículo.
- Si el contexto no contiene información suficiente, dilo expresamente.
- Nunca inventes normas, artículos, sentencias ni consecuencias jurídicas.
- Si la consulta está fuera del alcance de ContratoClaro, indícalo y no la resuelvas.
"""

    mensajes = [
        {
            "role": "system",
            "content": f"{prompt_base}\n\n{regla_rag}",
        },
        {
            "role": "user",
            "content": (
                f"CONTEXTO NORMATIVO:\n{contexto}\n\n"
                f"CONSULTA DEL USUARIO:\n{pregunta}"
            ),
        },
    ]

    respuesta = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "ContratoClaro - Proyecto académico",
        },
        json={
            "model": modelo,
            "messages": mensajes,
            "temperature": 0.1,
        },
        timeout=90,
    )

    respuesta.raise_for_status()
    datos = respuesta.json()

    return datos["choices"][0]["message"]["content"]


st.set_page_config(
    page_title="ContratoClaro",
    page_icon="⚖️",
    layout="centered",
)

st.title("⚖️ ContratoClaro")
st.caption("Entiende las cláusulas antes de firmar.")

st.warning(
    "Esta herramienta es un ejercicio académico que no constituye asesoría legal "
    "ni sustituye la consulta con un abogado."
)

st.write(
    "Revisión preliminar de contratos de arrendamiento de vivienda urbana y "
    "compraventa sencilla de bienes muebles entre particulares."
)

pregunta = st.text_area(
    "Escribe tu consulta o pega una cláusula del contrato:",
    height=180,
    placeholder=(
        "Ejemplo: Mi contrato dice que el canon puede aumentar en cualquier momento. "
        "¿Qué debería revisar?"
    ),
)

if st.button("Revisar", type="primary"):
    if not pregunta.strip():
        st.info("Escribe una consulta para continuar.")
    else:
        try:
            with st.spinner("Buscando en el corpus normativo..."):
                documentos, contexto = buscar_contexto(pregunta)
                respuesta = consultar_openrouter(pregunta, contexto)

            st.subheader("Respuesta")
            st.write(respuesta)

            with st.expander("Ver fragmentos normativos recuperados"):
                for i, documento in enumerate(documentos, start=1):
                    fuente = documento.metadata.get("source", "fuente no identificada")
                    st.markdown(f"**{i}. {fuente}**")
                    st.code(documento.page_content, language=None)

        except requests.HTTPError as error:
            st.error(
                "OpenRouter devolvió un error. Revisa que la API key sea válida "
                "y que tengas disponible un modelo gratuito."
            )
            st.exception(error)
        except Exception as error:
            st.error("No fue posible completar la consulta.")
            st.exception(error)
