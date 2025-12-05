#!/usr/bin/env python3
import json
from pathlib import Path
import numpy as np

def unify(sensors_path="sensors.json", out="unified_log.json"):
    d = json.load(open(sensors_path))
    # ensure sample rate and aligned arrays
    t = np.array(d['time'])
    keys = [k for k in d.keys() if k!="time"]
    # build per-timestamp objects
    rows = []
    for i in range(len(t)):
        row = {"time": float(t[i])}
        for k in keys:
            arr = d[k]
            if i < len(arr):
                row[k] = float(arr[i])
            else:
                row[k] = None
        rows.append(row)
    Path(out).write_text(json.dumps(rows, indent=2))
    print("Wrote", out)
    return out

if __name__ == "__main__":
    unify()
