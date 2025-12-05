# generate_dataset.py
import numpy as np
import pandas as pd
from features import signals_to_feature_vector
import os, json
from tqdm import trange

# simplified emulate functions (similar to backend/emulator version)
def emulate_zmpt(duration=0.1, fs=1000):
    t = np.linspace(0, duration, int(duration*fs))
    sig = (230.0/np.sqrt(2.0)) * np.sin(2*np.pi*50*t)
    return sig + 0.01*np.random.randn(len(t))

def emulate_acs(fault=False, duration=0.1, fs=1000):
    t = np.linspace(0, duration, int(duration*fs))
    base = 0.2 * np.sin(2*np.pi*50*t)
    if fault:
        # drift
        base = base + 0.5
    spikes = np.zeros_like(t)
    spikes[(t>0.03)&(t<0.031)] = 5.0
    return base + spikes + 0.02*np.random.randn(len(t))

def emulate_piezo(spike=False, duration=0.1, fs=1000):
    t = np.linspace(0, duration, int(duration*fs))
    s = 0.02*np.random.randn(len(t))
    if spike:
        s[(t>0.06)&(t<0.0605)] += 1.5
    return s

def make_sample(fault=None):
    v = emulate_zmpt()
    if fault == "acs":
        i = emulate_acs(fault=True)
        p = emulate_piezo(spike=False)
        label = 1
    elif fault == "piezo":
        i = emulate_acs(fault=False)
        p = emulate_piezo(spike=True)
        label = 2
    else:
        i = emulate_acs(fault=False)
        p = emulate_piezo(spike=False)
        label = 0
    signals = {"GPIO34": v, "GPIO35": i, "GPIO33": p}
    feats = signals_to_feature_vector(signals)
    feats['label'] = label
    return feats

def generate_csv(out="ml_data.csv", n_norm=500, n_acs=200, n_piezo=200):
    rows = []
    for _ in trange(n_norm):
        rows.append(make_sample(None))
    for _ in trange(n_acs):
        rows.append(make_sample("acs"))
    for _ in trange(n_piezo):
        rows.append(make_sample("piezo"))
    df = pd.DataFrame(rows)
    os.makedirs("ml_data", exist_ok=True)
    df.to_csv(os.path.join("ml_data", out), index=False)
    print("Saved", os.path.join("ml_data", out))

if __name__ == "__main__":
    generate_csv()
