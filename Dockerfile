FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies (now includes Flask + Redis)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy all your scripts
COPY app.py .
COPY fpl_scrape_ALL.py .
COPY fpl_scrape_rosters.py .

# Expose port for SSE server
EXPOSE 5000

# Run the unified app (Flask SSE + Background Scraper)
CMD ["python", "app.py"]