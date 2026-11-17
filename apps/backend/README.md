# Placement OS Backend

This is the Python FastAPI backend for Placement OS.

## Setup

1. Create a virtual environment:
   ```bash
   python3 -m venv .venv
   ```

2. Activate the virtual environment:
   ```bash
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Server

Start the development server with Uvicorn:

```bash
uvicorn app.main:app --reload
```

## Endpoints

- `GET /`: Returns `{"message": "Placement OS API is running"}`
