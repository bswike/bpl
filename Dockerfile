FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# If your scrapers have their own deps, list them here
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy worker + scraper scripts
COPY app.py .
COPY fpl_scrape_ALL.py .
COPY fpl_scrape_rosters.py .

CMD ["python", "app.py"]
