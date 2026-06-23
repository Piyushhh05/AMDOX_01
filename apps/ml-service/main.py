"""
Amdox ERP - AI Demand Forecasting Microservice
Python 3.13 + FastAPI + Prophet
"""
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import logging
from datetime import datetime, timedelta
import random

# Try to import Prophet; fall back to simple model if not installed
try:
    from prophet import Prophet
    import pandas as pd
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logging.warning("Prophet not installed - using fallback linear model")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Amdox ML Service",
    description="AI Demand Forecasting for Amdox ERP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("ML_SERVICE_API_KEY", "dev-key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(key: str = Security(api_key_header)):
    if key != API_KEY and os.getenv("NODE_ENV") != "development":
        raise HTTPException(status_code=403, detail="Invalid API key")
    return key

# ─── SCHEMAS ────────────────────────────────────────────────────────────────

class HistoricalDataPoint(BaseModel):
    date: str       # ISO date string
    quantity: float

class ForecastRequest(BaseModel):
    product_id: str
    historical_data: List[HistoricalDataPoint]
    forecast_days: int = 90

class ForecastPoint(BaseModel):
    date: str
    predicted_qty: float
    lower_bound: float
    upper_bound: float
    confidence: float

class ForecastResponse(BaseModel):
    product_id: str
    forecast: List[ForecastPoint]
    mape: Optional[float]
    model_used: str
    generated_at: str

# ─── ROUTES ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "prophet_available": PROPHET_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/forecast", response_model=ForecastResponse)
async def forecast_demand(req: ForecastRequest, _: str = Depends(verify_api_key)):
    """
    Generate demand forecast using Prophet (or fallback linear model).
    Accepts historical daily sales data and returns 90-day prediction.
    """
    logger.info(f"Forecasting for product {req.product_id}, {len(req.historical_data)} data points")

    if len(req.historical_data) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 historical data points")

    if PROPHET_AVAILABLE and len(req.historical_data) >= 14:
        return _prophet_forecast(req)
    else:
        return _simple_forecast(req)

def _prophet_forecast(req: ForecastRequest) -> ForecastResponse:
    """Full Prophet time-series model"""
    df = pd.DataFrame([{"ds": p.date, "y": p.quantity} for p in req.historical_data])
    df["ds"] = pd.to_datetime(df["ds"])

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.8,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=req.forecast_days)
    prediction = model.predict(future)
    forecast_df = prediction.tail(req.forecast_days)

    # Calculate MAPE on historical data
    historical_pred = prediction.head(len(req.historical_data))
    actual = [p.quantity for p in req.historical_data]
    predicted = historical_pred["yhat"].tolist()
    mape = sum(abs((a - p) / max(a, 1)) for a, p in zip(actual, predicted)) / len(actual) * 100

    forecast = [
        ForecastPoint(
            date=row["ds"].strftime("%Y-%m-%d"),
            predicted_qty=max(0, round(row["yhat"], 2)),
            lower_bound=max(0, round(row["yhat_lower"], 2)),
            upper_bound=max(0, round(row["yhat_upper"], 2)),
            confidence=0.80,
        )
        for _, row in forecast_df.iterrows()
    ]

    return ForecastResponse(
        product_id=req.product_id,
        forecast=forecast,
        mape=round(mape, 2),
        model_used="prophet",
        generated_at=datetime.now().isoformat(),
    )

def _simple_forecast(req: ForecastRequest) -> ForecastResponse:
    """Fallback: weighted moving average + trend"""
    quantities = [p.quantity for p in req.historical_data]
    n = len(quantities)

    # Weighted moving average (recent data weighted more)
    weights = list(range(1, n + 1))
    base = sum(q * w for q, w in zip(quantities, weights)) / sum(weights)

    # Simple trend
    if n >= 4:
        trend = (quantities[-1] - quantities[0]) / max(n - 1, 1) * 0.1
    else:
        trend = 0

    forecast = []
    last_date = datetime.fromisoformat(req.historical_data[-1].date)

    for i in range(1, req.forecast_days + 1):
        predicted = max(0, base + trend * i + random.gauss(0, base * 0.05))
        date = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
        forecast.append(ForecastPoint(
            date=date,
            predicted_qty=round(predicted, 2),
            lower_bound=round(predicted * 0.8, 2),
            upper_bound=round(predicted * 1.2, 2),
            confidence=0.65,
        ))

    return ForecastResponse(
        product_id=req.product_id,
        forecast=forecast,
        mape=None,
        model_used="weighted_moving_average",
        generated_at=datetime.now().isoformat(),
    )

@app.get("/forecast/summary/{product_id}")
async def get_forecast_summary(product_id: str, _: str = Depends(verify_api_key)):
    """Quick 30-day summary without requiring historical data (demo mode)"""
    today = datetime.now()
    base_qty = random.uniform(20, 100)

    forecast = []
    for i in range(1, 31):
        qty = max(0, base_qty + random.gauss(0, base_qty * 0.1))
        forecast.append({
            "date": (today + timedelta(days=i)).strftime("%Y-%m-%d"),
            "predicted_qty": round(qty, 2),
        })

    return {
        "product_id": product_id,
        "next_30_days_avg": round(base_qty, 2),
        "trend": "STABLE",
        "forecast": forecast,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
