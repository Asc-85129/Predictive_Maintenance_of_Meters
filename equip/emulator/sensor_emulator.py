#!/usr/bin/env python3
"""
sensor_emulator.py
Given simdata.json (columns: time, V(node), I(V1) ...),
produce sensor ADC outputs for:
- ZMPT101B => GPIO34 (0-3.3V approximate)
- ACS712 => GPIO35 (centered ~2.5V)
- NTC => GPIO32 (voltage divider)
- Piezo envelope => GPIO33
- Relay drive sense => GPIO26 (digital drive)
Outputs unified sensors.json
"""
import json
import numpy as np
from pathlib import Path

def load_simjson(path="simdata.json"):
    return json.load(open(path))

def emulate_zmpt(simdata, voltage_node_key, vcc=3.3):
    # simdata has V(node) for mains (peak value). We'll convert instantaneous voltage -> sensor ADC reading 0..3.3
    # Map: Vpeak ~ 325V -> sensor amplitude -> 0.006 * Vin + offset (example)
    v = np.array(simdata.get(voltage_node_key))
    # v likely is instantaneous voltage; scale factor chosen for module mapping in earlier scripts
    out = 1.5 + 0.006 * v + 0.01 * np.random.randn(len(v))
    return out.tolist()

def emulate_acs(simdata, current_key, vcc=3.3, sensitivity=0.066):
    # ACS712 outputs Vcc/2 + sensitivity * I (A)
    # If current_key holds I(V1) (current through source), we map that current to ACS reading
    i = np.array(simdata.get(current_key))
    # i may be source current; ensure correct sign
    out = (vcc/2.0) + sensitivity * i + 0.01 * np.random.randn(len(i))
    return out.tolist()

def emulate_ntc(simdata, temp_node_key):
    # If SPICE did not simulate thermal model, we use node voltage as proxy for temperature node
    v = simdata.get(temp_node_key)
    if v is None:
        # fallback: generate slow ramp
        n = len(simdata['time'])
        t = np.array(simdata['time'])
        temps = 30.0 + 0.01 * t
    else:
        # map voltage to temperature by linear scaling for demo
        arr = np.array(v)
        temps = 25.0 + (arr - arr.mean())*5.0
    # convert temperature to divider voltage: assume Vout = 1.65 + (T - 25)*0.01
    volt = 1.65 + (temps - 25.0) * 0.01
    return volt.tolist()

def emulate_piezo(simdata, piezo_key):
    arr = np.array(simdata.get(piezo_key)) if piezo_key in simdata else np.zeros_like(np.array(simdata['time']))
    # envelope detector simulation: absolute + RC smoothing
    env = np.abs(arr)
    # simple lowpass smoothing
    alpha = 0.05
    out = []
    s = 0.0
    for x in env:
        s = alpha * x + (1 - alpha) * s
        out.append(s + 0.005*np.random.randn())
    return out

def emulate_relay(simdata, relay_key):
    # If relay drive is present, it may be 0/1 waveform
    arr = np.array(simdata.get(relay_key)) if relay_key in simdata else np.zeros_like(np.array(simdata['time']))
    return arr.tolist()

def run_emulator(simjson="simdata.json", mapping=None, out="sensors.json"):
    simdata = load_simjson(simjson)
    # mapping keys
    if mapping is None:
        mapping = {
            "voltage_node_key": "V(n_ac)",
            "current_key": "I(V1)",
            "temp_node_key": "V(n_therm)",
            "piezo_key": "V(n_piezo)",
            "relay_key": "V(n_relay)"
        }
    outdict = {"time": simdata.get("time", [])}
    # voltage sensor
    if mapping.get("voltage_node_key") in simdata:
        outdict["GPIO34"] = emulate_zmpt(simdata, mapping["voltage_node_key"])
    if mapping.get("current_key") in simdata:
        outdict["GPIO35"] = emulate_acs(simdata, mapping["current_key"])
    if mapping.get("temp_node_key") in simdata:
        outdict["GPIO32"] = emulate_ntc(simdata, mapping["temp_node_key"])
    if mapping.get("piezo_key") in simdata:
        outdict["GPIO33"] = emulate_piezo(simdata, mapping["piezo_key"])
    if mapping.get("relay_key") in simdata:
        outdict["GPIO26"] = emulate_relay(simdata, mapping["relay_key"])
    Path(out).write_text(json.dumps(outdict, indent=2))
    print(f"Wrote sensor outputs to {out}")
    return out

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--sim", "-s", default="../spice_runner/simdata.json")
    p.add_argument("--out", "-o", default="sensors.json")
    args = p.parse_args()
    run_emulator(args.sim, out=args.out)
