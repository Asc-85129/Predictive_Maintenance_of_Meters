# serve_model.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np
import uvicorn
import json

class Payload(BaseModel):
    features: dict

app = FastAPI()
model = joblib.load("ml_models/xgb_model.joblib")

@app.post("/predict")
def predict(payload: Payload):
    feat = payload.features
    # ensure deterministic order of features: use model.feature_names_in_ if available
    if hasattr(model, 'feature_names_in_'):
        keys = list(model.feature_names_in_)
    else:
        keys = sorted(feat.keys())
    X = np.array([feat.get(k,0) for k in keys]).reshape(1,-1)
    pred = int(model.predict(X)[0])
    proba = float(model.predict_proba(X).max())
    return {"pred": pred, "confidence": proba}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9000)
