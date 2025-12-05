# features.py
import numpy as np
import pandas as pd
from scipy import stats

def windowed_features(series, window_size=100, step=50):
    # simple sliding windows -> produce list of feature dicts
    X = []
    for start in range(0, len(series)-window_size+1, step):
        w = series[start:start+window_size]
        X.append(extract_basic_stats(w))
    return X

def extract_basic_stats(arr):
    arr = np.array(arr)
    return {
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr)),
        "max": float(np.max(arr)),
        "min": float(np.min(arr)),
        "rms": float(np.sqrt(np.mean(arr**2))),
        "skew": float(stats.skew(arr)),
        "kurt": float(stats.kurtosis(arr))
    }

def signals_to_feature_vector(signals):
    # signals: dictionary of arrays for GPIO34..GPIO35...
    features = {}
    for name, arr in signals.items():
        stats = extract_basic_stats(arr)
        for k,v in stats.items():
            features[f"{name}_{k}"] = v
    return features
