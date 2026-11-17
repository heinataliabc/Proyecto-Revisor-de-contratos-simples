# Cómo ejecutar ContratoClaro en local

Este proyecto usa Python, Streamlit, LangChain, FAISS y OpenRouter.

## 1. Crear el archivo de entorno

En la raíz del proyecto crea un archivo llamado `.env` con:

```text
OPENROUTER_API_KEY=TU_CLAVE_REAL
OPENROUTER_MODEL=openrouter/free
```

No subas `.env` a GitHub. Ya está incluido en `.gitignore`.

## 2. Instalar dependencias

```bash
python -m pip install -r requirements.txt
```

## 3. Construir el índice del corpus

```bash
python build_corpus.py
```

Si funciona, aparecerá la carpeta local `db/`.

## 4. Ejecutar la aplicación

```bash
python -m streamlit run app.py
```

Se abrirá ContratoClaro en el navegador.

## 5. Pruebas académicas

Ejecuta los cinco casos de `docs/casos-de-prueba.md`.

Para cada caso:
- copia la pregunta en ContratoClaro;
- guarda un resumen fiel de la respuesta real;
- marca si pasó o falló;
- no uses datos personales reales.

## Criterio para cerrar M3

M3 solo se marca como completado cuando:
- el corpus está indexado;
- la aplicación responde usando los fragmentos recuperados;
- cita norma y artículo cuando el contexto los contiene;
- ante una pregunta sin fuente suficiente, admite que no tiene base;
- no existe ninguna API key en el repositorio.
