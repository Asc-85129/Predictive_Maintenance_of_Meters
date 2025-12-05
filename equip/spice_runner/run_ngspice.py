#!/usr/bin/env python3
"""
run_ngspice.py
Runs ngspice in batch mode on a netlist and parses printed transient table into CSV/JSON.
"""
import subprocess
import sys
from pathlib import Path
import re
import csv
import json

def run_ngspice(netlist_path: str, out_txt="ngspice_out.txt"):
    # run ngspice -b netlist
    cmd = ["ngspice", "-b", "-o", out_txt, netlist_path]
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("ngspice failed: rc", res.returncode)
        print("stdout:", res.stdout)
        print("stderr:", res.stderr)
        raise RuntimeError("ngspice failed")
    print("ngspice finished, output saved to", out_txt)
    return out_txt

def parse_printed_table(out_txt):
    """
    Parse ngspice output text for the printed transient table lines.
    ngspice prints lines like:
    Index     time      V(n_ac)     I(V1)
    0   0.000000e+00  ...
    We'll detect the first "Index" header and read subsequent columns.
    """
    txt = Path(out_txt).read_text()
    lines = txt.splitlines()
    header_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("Index") and "time" in line:
            header_idx = i
            break
    if header_idx is None:
        # fallback: search for a block "transient analysis"
        raise RuntimeError("Could not find transient printed table in ngspice output")
    header_line = lines[header_idx]
    headers = re.split(r'\s+', header_line.strip())
    data_lines = []
    for line in lines[header_idx+1:]:
        if not line.strip(): break
        if line.strip().startswith("Index"): break
        parts = re.split(r'\s+', line.strip())
        if len(parts) < len(headers): continue
        data_lines.append(parts[:len(headers)])
    # write CSV
    csv_path = "simdata.csv"
    with open(csv_path,"w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(data_lines)
    print("Wrote", csv_path)
    # also convert to JSON arrays
    col_data = {h: [] for h in headers}
    for row in data_lines:
        for h, v in zip(headers, row):
            col_data[h].append(float(v.replace("D", "E")))
    json_path = "simdata.json"
    with open(json_path, "w") as f:
        json.dump(col_data, f, indent=2)
    print("Wrote", json_path)
    return json_path

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--net", "-n", default="circuit.sp")
    args = p.parse_args()
    out_txt = run_ngspice(args.net)
    parse_printed_table(out_txt)
