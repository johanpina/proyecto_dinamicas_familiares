FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "psycopg[binary]>=3.2"

COPY app ./app
COPY static ./static
COPY usuarios.py .

# La base SQLite y la llave de sesión viven aquí: monte un volumen en producción
RUN mkdir -p /app/datos
ENV DIR_DATOS=/app/datos

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
