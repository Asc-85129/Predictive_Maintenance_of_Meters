import json
import numpy as np
import requests
from features import signals_to_feature_vector

# load processed sensor JSON
with open(r"D:\INSTINCT4.0\sensors.json") as f:
    u = json.load(f)

# check available keys
print("Available keys:", list(u.keys()))

# pick signals for ML
signal_map = {
    'GPIO34': 'GPIO34',  # AC voltage
    'GPIO35': 'GPIO35',  # AC current
    'GPIO33': 'GPIO33'   # Relay / output node
}

spice_signals = {}
for k, alias in signal_map.items():
    if k in u and len(u[k]) > 0:
        arr = np.array(u[k], dtype=float)
        # replace nan or inf with 0
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
        spice_signals[alias] = arr
    else:
        print(f"Warning: {k} missing or empty, skipping...")

if not spice_signals:
    raise RuntimeError("No valid signal arrays found in sensors.json")

# compute features
feats = signals_to_feature_vector(spice_signals)

# sanitize features for JSON
def sanitize_json(d):
    for k, v in d.items():
        if isinstance(v, float):
            if np.isnan(v) or np.isinf(v):
                d[k] = 0.0
        elif isinstance(v, dict):
            sanitize_json(v)
        elif isinstance(v, list):
            d[k] = [0.0 if (isinstance(x, float) and (np.isnan(x) or np.isinf(x))) else x for x in v]
    return d

feats = sanitize_json(feats)

# send to prediction server (use 127.0.0.1)
try:
    resp = requests.post("http://127.0.0.1:9000/predict", json={"features": feats})
    resp.raise_for_status()
    print("Predictions:", resp.json())
except requests.RequestException as e:
    print("Error contacting prediction server:", e)
