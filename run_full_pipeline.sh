#!/usr/bin/env bash
# quick runner: generate netlist, run ngspice, emulate sensors, unify, call model (if exists)
set -e
echo "1) JSON -> SPICE"
python3 converter/json_to_spice.py --json ui/example_circuit.json --out circuit.sp
echo "2) Run ngspice"
python3 spice_runner/run_ngspice.py --net circuit.sp
echo "3) Emulate sensors"
python3 emulator/sensor_emulator.py --sim spice_runner/simdata.json --out emulator/sensors.json
echo "4) unify logger"
python3 ingest/unify_logger.py
echo "Pipeline complete. sensors.json and unified_log.json generated."
