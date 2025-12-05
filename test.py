import pandas as pd
import json
from io import StringIO

# read raw lines
with open("ngspice_out.txt") as f:
    lines = f.readlines()

# locate the table start: find the line with 'Index' (header line)
start_idx = 0
for i, line in enumerate(lines):
    if line.strip().startswith("Index"):
        start_idx = i
        break

# find where the table ends (empty line or dashed lines)
data_lines = []
for line in lines[start_idx:]:
    if line.strip() == "" or line.strip().startswith("Total analysis time"):
        break
    data_lines.append(line)

# read the table into pandas
df = pd.read_csv(
    StringIO("".join(data_lines)),
    sep=r'\s+',  # use regex separator for whitespace
    engine='python'
)

# optionally rename columns to match your ML script
df = df.rename(columns={
    'time': 'time',
    'v(n_ac)': 'GPIO34',     # map to your ESP32 ADC pins
    'v1#branch': 'GPIO35',
    'v(n_out)': 'GPIO33'
})

# convert to dict for ML
data = {k: df[k].tolist() for k in df.columns}

# save JSON
with open("sensors.json", "w") as f:
    json.dump(data, f, indent=2)

print("sensors.json generated with keys:", list(data.keys()))
