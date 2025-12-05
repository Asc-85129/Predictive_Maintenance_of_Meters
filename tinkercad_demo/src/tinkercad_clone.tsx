import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Zap,
  Trash2,
  Play,
  Square,
  RotateCw,
  Settings,
  Eye,
  EyeOff,
  Save,
  Upload,
} from "lucide-react";

/**
 * Strict TypeScript types for the circuit simulator
 */

type ComponentType =
  | "esp32"
  | "resistor"
  | "capacitor"
  | "led"
  | "thermistor"
  | "acs712"
  | "zmpt101b"
  | "relay"
  | "piezo"
  | "battery"
  | "ground"
  | "voltmeter"
  | "ammeter"
  | string;

interface ComponentPin {
  id: string;
  x?: number;
  y?: number;
  label?: string;
}

export interface CircuitComponent {
  id: number;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  pins: ComponentPin[];
  value?: string | number;
  voltage?: string | number;
}

interface WireEndpoint {
  componentId: number;
  pinId: string;
}

interface Wire {
  id: number;
  from: WireEndpoint;
  to: WireEndpoint;
  color?: string;
}

type MeasurementsMap = Record<number, string>;

interface DraggingState {
  id: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Template type used for creating components from the library
 */
interface ComponentTemplate {
  type: ComponentType;
  label: string;
  width?: number;
  height?: number;
  color?: string;
  value?: string | number;
  pins?: ComponentPin[] | number; // number for quick shorthand like esp32 pin count
}

/**
 * Component
 */
const CircuitSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [components, setComponents] = useState<CircuitComponent[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<CircuitComponent | null>(null);
  const [draggingComponent, setDraggingComponent] = useState<DraggingState | null>(null);
  const [wiringMode, setWiringMode] = useState<boolean>(false);
  const [wireStart, setWireStart] = useState<WireEndpoint | null>(null);
  const [hoveredPin, setHoveredPin] = useState<WireEndpoint | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [measurements, setMeasurements] = useState<MeasurementsMap>({});
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [simulationData, setSimulationData] = useState<{ voltage: string; current: string; power: string }>({
    voltage: "0.00",
    current: "0.0",
    power: "0.0",
  });

  const componentLibrary: ComponentTemplate[] = [
    { type: "esp32", label: "ESP32", width: 120, height: 180, color: "#1a1a2e", pins: 38 },
    { type: "resistor", label: "Resistor", width: 80, height: 30, color: "#D2691E", value: "10k" },
    { type: "capacitor", label: "Capacitor", width: 40, height: 60, color: "#4169E1", value: "100nF" },
    { type: "led", label: "LED", width: 40, height: 60, color: "#FF0000" },
    { type: "thermistor", label: "NTC 10k", width: 60, height: 60, color: "#8B4513" },
    { type: "acs712", label: "ACS712", width: 80, height: 80, color: "#2F4F4F" },
    { type: "zmpt101b", label: "ZMPT101B", width: 80, height: 80, color: "#483D8B" },
    { type: "relay", label: "Relay 5V", width: 60, height: 80, color: "#556B2F" },
    { type: "piezo", label: "Piezo", width: 50, height: 50, color: "#FF6347" },
    { type: "battery", label: "Battery", width: 40, height: 80, color: "#FFD700", value: "5V" },
    { type: "ground", label: "Ground", width: 40, height: 40, color: "#000" },
    { type: "voltmeter", label: "Voltmeter", width: 60, height: 60, color: "#00CED1" },
    { type: "ammeter", label: "Ammeter", width: 60, height: 60, color: "#FF1493" },
  ];

  /**
   * Simulation effect — updates measurements and live data while simulating
   */
  useEffect(() => {
    if (!isSimulating) {
      setMeasurements({});
      return;
    }

    const interval = window.setInterval(() => {
      const baseVoltage = 3.3;
      const voltage = baseVoltage + Math.sin(Date.now() / 1000) * 0.1;
      const current = 45 + Math.sin(Date.now() / 800) * 5;
      const power = voltage * current;

      setSimulationData({
        voltage: voltage.toFixed(2),
        current: current.toFixed(1),
        power: power.toFixed(1),
      });

      const newMeasurements: MeasurementsMap = {};
      components.forEach((comp) => {
        if (comp.type === "voltmeter") {
          const v = (Math.random() * 5).toFixed(2);
          newMeasurements[comp.id] = `${v}V`;
        } else if (comp.type === "ammeter") {
          const a = (Math.random() * 500).toFixed(0);
          newMeasurements[comp.id] = `${a}mA`;
        }
      });
      setMeasurements(newMeasurements);
    }, 100);

    return () => window.clearInterval(interval);
  }, [isSimulating, components]);

  /**
   * Compute pin positions for each component
   */
  const getPinPositions = (component: CircuitComponent): ComponentPin[] => {
    const pins: ComponentPin[] = [];
    const { x, y, width, height, type } = component;

    if (type === "esp32") {
      // left side L0..L18 and right side R0..R18
      for (let i = 0; i < 19; i++) {
        pins.push({ id: `L${i}`, x: x, y: y + 20 + i * 8, label: `GPIO${i}` });
      }
      for (let i = 0; i < 19; i++) {
        pins.push({ id: `R${i}`, x: x + width, y: y + 20 + i * 8, label: `GPIO${19 + i}` });
      }
    } else if (type === "resistor" || type === "capacitor") {
      pins.push({ id: "A", x: x, y: y + height / 2 });
      pins.push({ id: "B", x: x + width, y: y + height / 2 });
    } else if (type === "led") {
      pins.push({ id: "anode", x: x + width / 2, y: y, label: "+" });
      pins.push({ id: "cathode", x: x + width / 2, y: y + height, label: "-" });
    } else if (type === "thermistor" || type === "piezo") {
      pins.push({ id: "A", x: x, y: y + height / 2 });
      pins.push({ id: "B", x: x + width, y: y + height / 2 });
    } else if (type === "acs712" || type === "zmpt101b") {
      pins.push({ id: "VCC", x: x, y: y + 20, label: "VCC" });
      pins.push({ id: "GND", x: x, y: y + 40, label: "GND" });
      pins.push({ id: "OUT", x: x + width, y: y + 40, label: "OUT" });
    } else if (type === "relay") {
      pins.push({ id: "coil1", x: x, y: y + 20, label: "C+" });
      pins.push({ id: "coil2", x: x, y: y + 60, label: "C-" });
      pins.push({ id: "NO", x: x + width, y: y + 20, label: "NO" });
      pins.push({ id: "COM", x: x + width, y: y + 40, label: "COM" });
      pins.push({ id: "NC", x: x + width, y: y + 60, label: "NC" });
    } else if (type === "battery") {
      pins.push({ id: "pos", x: x + width / 2, y: y, label: "+" });
      pins.push({ id: "neg", x: x + width / 2, y: y + height, label: "-" });
    } else if (type === "ground") {
      pins.push({ id: "gnd", x: x + width / 2, y: y });
    } else if (type === "voltmeter" || type === "ammeter") {
      pins.push({ id: "pos", x: x, y: y + height / 2, label: "+" });
      pins.push({ id: "neg", x: x + width, y: y + height / 2, label: "-" });
    }

    return pins;
  };

  /**
   * Drawing helpers — typed with CanvasRenderingContext2D
   */
  const drawComponent = (ctx: CanvasRenderingContext2D, component: CircuitComponent) => {
    const { x, y, width, height, type, color, label, value } = component;
    const isSelected = selectedComponent?.id === component.id;

    ctx.save();

    if (isSelected) {
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
    }

    ctx.fillStyle = color ?? "#666";

    // draw many different component types (kept same visually as original)
    if (type === "esp32") {
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("ESP32", x + 35, y + height / 2);

      ctx.fillStyle = "#FFD700";
      for (let i = 0; i < 19; i++) {
        ctx.fillRect(x - 5, y + 20 + i * 8, 5, 4);
        ctx.fillRect(x + width, y + 20 + i * 8, 5, 4);
      }
    } else if (type === "resistor") {
      ctx.fillRect(x + 15, y, width - 30, height);
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.fillText(String(value ?? "10k"), x + 25, y + 20);

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + height / 2);
      ctx.lineTo(x + 15, y + height / 2);
      ctx.moveTo(x + width - 15, y + height / 2);
      ctx.lineTo(x + width, y + height / 2);
      ctx.stroke();
    } else if (type === "capacitor") {
      ctx.fillRect(x + width / 2 - 2, y + 5, 4, height - 10);
      ctx.fillRect(x + width / 2 - 12, y + 5, 4, height - 10);

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + height / 2);
      ctx.lineTo(x + width / 2 - 12, y + height / 2);
      ctx.moveTo(x + width, y + height / 2);
      ctx.lineTo(x + width / 2 - 2, y + height / 2);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "10px Arial";
      ctx.fillText(String(value ?? "100nF"), x + 5, y + height - 5);
    } else if (type === "led") {
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + 15);
      ctx.lineTo(x + 10, y + height - 20);
      ctx.lineTo(x + width - 10, y + height - 20);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color ?? "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, 15, 0, Math.PI * 2);
      ctx.stroke();

      if (isSimulating) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = color ?? "#fff";
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width / 2, y - 10);
      ctx.moveTo(x + width / 2, y + height);
      ctx.lineTo(x + width / 2, y + height + 10);
      ctx.stroke();
    } else if (type === "thermistor" || type === "piezo") {
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Arial";
      ctx.fillText(type === "thermistor" ? "NTC" : "PZ", x + width / 2 - 14, y + height / 2 + 4);
    } else if (type === "acs712" || type === "zmpt101b") {
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Arial";
      const txt = type === "acs712" ? "ACS712" : "ZMPT";
      ctx.fillText(txt, x + 15, y + height / 2);

      ctx.fillStyle = "#FFD700";
      ctx.fillRect(x - 5, y + 20, 5, 4);
      ctx.fillRect(x - 5, y + 40, 5, 4);
      ctx.fillRect(x + width, y + 40, 5, 4);
    } else if (type === "relay") {
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.fillText("RLY", x + 15, y + height / 2);

      ctx.fillStyle = "#FFD700";
      [20, 60, 20, 40, 60].forEach((py, i) => {
        if (i < 2) ctx.fillRect(x - 5, y + py, 5, 4);
        else ctx.fillRect(x + width, y + py, 5, 4);
      });
    } else if (type === "battery") {
      ctx.fillRect(x + 10, y + 10, width - 20, 15);
      ctx.fillRect(x + 5, y + height - 25, width - 10, 15);

      ctx.fillStyle = "#000";
      ctx.font = "bold 18px Arial";
      ctx.fillText("+", x + width / 2 - 6, y + 23);
      ctx.fillText("-", x + width / 2 - 5, y + height - 11);
    } else if (type === "ground") {
      ctx.strokeStyle = color ?? "#000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width / 2, y + 15);
      ctx.stroke();

      [width, width * 0.7, width * 0.4].forEach((w, i) => {
        ctx.beginPath();
        ctx.moveTo(x + width / 2 - w / 2, y + 15 + i * 8);
        ctx.lineTo(x + width / 2 + w / 2, y + 15 + i * 8);
        ctx.stroke();
      });
    } else if (type === "voltmeter" || type === "ammeter") {
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px Arial";
      ctx.fillText(type === "voltmeter" ? "V" : "A", x + width / 2 - 10, y + height / 2 + 9);

      if (isSimulating && measurements[component.id]) {
        ctx.fillStyle = "#000";
        ctx.fillRect(x - 5, y - 30, width + 10, 22);
        ctx.fillStyle = "#0F0";
        ctx.font = "bold 14px monospace";
        ctx.fillText(measurements[component.id], x + 5, y - 12);
      }
    }

    if (label) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.fillText(label, x, y - 8);
    }

    ctx.restore();

    // draw pins
    const pins = getPinPositions(component);
    pins.forEach((pin) => {
      const isHovered = hoveredPin?.componentId === component.id && hoveredPin?.pinId === pin.id;
      ctx.fillStyle = isHovered ? "#00FF00" : "#FFD700";
      ctx.beginPath();
      ctx.arc(pin.x ?? 0, pin.y ?? 0, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      if (pin.label && (isSelected || isHovered)) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Arial";
        ctx.fillText(pin.label, (pin.x ?? 0) + 8, (pin.y ?? 0) + 4);
      }
    });
  };

  const drawWire = (ctx: CanvasRenderingContext2D, wire: Wire) => {
    const fromComp = components.find((c) => c.id === wire.from.componentId);
    const toComp = components.find((c) => c.id === wire.to.componentId);

    if (!fromComp || !toComp) return;

    const fromPins = getPinPositions(fromComp);
    const toPins = getPinPositions(toComp);
    const fromPin = fromPins.find((p) => p.id === wire.from.pinId);
    const toPin = toPins.find((p) => p.id === wire.to.pinId);

    if (!fromPin || !toPin) return;

    ctx.strokeStyle = wire.color ?? "#FFA500";
    ctx.lineWidth = 3;
    ctx.shadowBlur = isSimulating ? 5 : 0;
    ctx.shadowColor = wire.color ?? "#FFA500";

    ctx.beginPath();
    ctx.moveTo(fromPin.x ?? 0, fromPin.y ?? 0);
    const midX = ((fromPin.x ?? 0) + (toPin.x ?? 0)) / 2;
    ctx.bezierCurveTo(midX, fromPin.y ?? 0, midX, toPin.y ?? 0, toPin.x ?? 0, toPin.y ?? 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (isSimulating) {
      const textX = midX;
      const textY = ((fromPin.y ?? 0) + (toPin.y ?? 0)) / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(textX - 28, textY - 12, 56, 18);
      ctx.fillStyle = "#0F0";
      ctx.font = "bold 11px monospace";
      const voltage = (Math.random() * 3.3).toFixed(2);
      ctx.fillText(`${voltage}V`, textX - 22, textY + 3);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!showGrid) return;

    ctx.strokeStyle = "#2a2a3e";
    ctx.lineWidth = 1;

    for (let gx = 0; gx < width; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }

    for (let gy = 0; gy < height; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }
  };

  /**
   * renderCanvas: draws grid, wires, components, and wiring preview
   */
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid(ctx, canvas.width, canvas.height);
    wires.forEach((w) => drawWire(ctx, w));
    components.forEach((c) => drawComponent(ctx, c));

    if (wiringMode && wireStart) {
      const fromComp = components.find((c) => c.id === wireStart.componentId);
      if (fromComp) {
        const fromPins = getPinPositions(fromComp);
        const fromPin = fromPins.find((p) => p.id === wireStart.pinId);
        if (fromPin) {
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(fromPin.x ?? 0, fromPin.y ?? 0);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }, [components, wires, wiringMode, wireStart, mousePos, hoveredPin, measurements, isSimulating, showGrid]);

  // Re-render whenever things change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  /**
   * Canvas event handlers — fully typed
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (wiringMode) {
      for (const comp of components) {
        const pins = getPinPositions(comp);
        for (const pin of pins) {
          const dist = Math.hypot(x - (pin.x ?? 0), y - (pin.y ?? 0));
          if (dist < 10) {
            if (!wireStart) {
              setWireStart({ componentId: comp.id, pinId: pin.id });
            } else {
              setWires((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  from: wireStart,
                  to: { componentId: comp.id, pinId: pin.id },
                  color: "#FFA500",
                },
              ]);
              setWireStart(null);
              setWiringMode(false);
            }
            return;
          }
        }
      }
    } else {
      let clicked: CircuitComponent | null = null;
      for (let i = components.length - 1; i >= 0; i--) {
        const comp = components[i];
        if (x >= comp.x && x <= comp.x + comp.width && y >= comp.y && y <= comp.y + comp.height) {
          clicked = comp;
          break;
        }
      }
      setSelectedComponent(clicked);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    let foundPin: WireEndpoint | null = null;
    for (const comp of components) {
      const pins = getPinPositions(comp);
      for (const pin of pins) {
        const dist = Math.hypot(x - (pin.x ?? 0), y - (pin.y ?? 0));
        if (dist < 10) {
          foundPin = { componentId: comp.id, pinId: pin.id };
          break;
        }
      }
      if (foundPin) break;
    }
    setHoveredPin(foundPin);

    if (draggingComponent) {
      setComponents((prev) =>
        prev.map((comp) =>
          comp.id === draggingComponent.id
            ? { ...comp, x: x - draggingComponent.offsetX, y: y - draggingComponent.offsetY }
            : comp
        )
      );
      setSelectedComponent((prev) =>
        prev && prev.id === draggingComponent.id ? { ...prev, x: x - draggingComponent.offsetX, y: y - draggingComponent.offsetY } : prev
      );
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (wiringMode || !selectedComponent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= selectedComponent.x && x <= selectedComponent.x + selectedComponent.width && y >= selectedComponent.y && y <= selectedComponent.y + selectedComponent.height) {
      setDraggingComponent({
        id: selectedComponent.id,
        offsetX: x - selectedComponent.x,
        offsetY: y - selectedComponent.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingComponent(null);
  };

  /**
   * Add / delete / rotate / clear / save / load
   */
  const addComponent = (compType: ComponentType) => {
    const template = componentLibrary.find((c) => c.type === compType);
    if (!template) return;

    const pinsFromTemplate: ComponentPin[] =
      typeof template.pins === "number"
        ? Array.from({ length: template.pins / 2 }, (_, i) => ({ id: `pL${i}` })).concat(
            Array.from({ length: template.pins / 2 }, (_, i) => ({ id: `pR${i}` }))
          )
        : (template.pins ?? [{ id: "p1" }, { id: "p2" }]);

    const newComp: CircuitComponent = {
      id: Date.now(),
      type: template.type,
      label: template.label,
      x: 400 + Math.random() * 200,
      y: 150 + Math.random() * 200,
      width: template.width ?? 60,
      height: template.height ?? 30,
      rotation: 0,
      color: template.color ?? "#888",
      pins: pinsFromTemplate,
      value: template.value,
    };

    setComponents((prev) => [...prev, newComp]);
  };

  const deleteSelected = useCallback(() => {
    if (!selectedComponent) return;
    setComponents((prev) => prev.filter((c) => c.id !== selectedComponent.id));
    setWires((prev) => prev.filter((w) => w.from.componentId !== selectedComponent.id && w.to.componentId !== selectedComponent.id));
    setSelectedComponent(null);
  }, [selectedComponent]);

  const rotateSelected = () => {
    if (!selectedComponent) return;
    setComponents((prev) => prev.map((comp) => (comp.id === selectedComponent.id ? { ...comp, rotation: ((comp.rotation ?? 0) + 90) % 360 } : comp)));
    setSelectedComponent((prev) => (prev ? { ...prev, rotation: ((prev.rotation ?? 0) + 90) % 360 } : prev));
  };

  const startSimulation = () => setIsSimulating(true);
  const stopSimulation = () => {
    setIsSimulating(false);
    setMeasurements({});
  };

  const clearCanvas = () => {
    if (window.confirm("Clear all components and wires?")) {
      setComponents([]);
      setWires([]);
      setSelectedComponent(null);
      setMeasurements({});
    }
  };

  const saveCircuit = () => {
    const data = JSON.stringify({ components, wires }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadCircuit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      try {
        const raw = evt.target?.result;
        if (typeof raw !== "string") {
          alert("Invalid file content");
          return;
        }
        const data = JSON.parse(raw);
        // Validate shape lightly
        const loadedComponents = Array.isArray(data.components) ? data.components : [];
        const loadedWires = Array.isArray(data.wires) ? data.wires : [];
        setComponents(loadedComponents);
        setWires(loadedWires);
      } catch (err) {
        alert("Invalid circuit file");
      }
    };
    reader.readAsText(file);
    // reset input so same file can be reloaded later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /**
   * Keyboard delete listener
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedComponent) {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedComponent, deleteSelected]);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Components
        </h2>

        <div className="space-y-2">
          {componentLibrary.map((comp) => (
            <button
              key={comp.type}
              onClick={() => addComponent(comp.type)}
              className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded text-left transition-colors"
            >
              <div className="font-semibold">{comp.label}</div>
              <div className="text-xs text-gray-400">{comp.type}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setWiringMode((s) => !s);
              setWireStart(null);
            }}
            className={`p-2 rounded ${wiringMode ? "bg-green-600" : "bg-gray-700"} hover:bg-gray-600 transition-colors`}
            title="Wire Mode"
          >
            <Zap className="w-5 h-5" />
          </button>

          <button
            onClick={deleteSelected}
            disabled={!selectedComponent}
            className="p-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            onClick={rotateSelected}
            disabled={!selectedComponent}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 transition-colors"
            title="Rotate"
          >
            <RotateCw className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-gray-600 mx-2" />

          {!isSimulating ? (
            <button onClick={startSimulation} className="p-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-2 transition-colors" title="Start Simulation">
              <Play className="w-5 h-5" />
              <span>Simulate</span>
            </button>
          ) : (
            <button onClick={stopSimulation} className="p-2 bg-orange-600 hover:bg-orange-700 rounded flex items-center gap-2 transition-colors animate-pulse" title="Stop Simulation">
              <Square className="w-5 h-5" />
              <span>Stop</span>
            </button>
          )}

          <div className="h-6 w-px bg-gray-600 mx-2" />

          <button onClick={() => setShowGrid((s) => !s)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="Toggle Grid">
            {showGrid ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>

          <button onClick={clearCanvas} className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="Clear All">
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-gray-600 mx-2" />

          <button onClick={saveCircuit} className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors" title="Save Circuit">
            <Save className="w-5 h-5" />
          </button>

          <label className="p-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer transition-colors" title="Load Circuit">
            <Upload className="w-5 h-5" />
            <input ref={fileInputRef} type="file" accept=".json" onChange={loadCircuit} className="hidden" />
          </label>

          <div className="flex-1" />

          <div className="text-sm">
            {wiringMode && <span className="text-green-400 font-semibold">🔌 Wiring Mode Active</span>}
            {selectedComponent && !wiringMode && <span className="text-blue-400 font-semibold">Selected: {selectedComponent.label}</span>}
          </div>
        </div>

        <div className="flex-1 bg-gray-900 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1600}
            height={900}
            className="cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>

        <div className="bg-gray-800 p-2 border-t border-gray-700 flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span className="text-gray-400">Components: <span className="text-white font-semibold">{components.length}</span></span>
            <span className="text-gray-400">Wires: <span className="text-white font-semibold">{wires.length}</span></span>
            <span className="text-gray-400">Position: <span className="text-white font-mono">({mousePos.x.toFixed(0)}, {mousePos.y.toFixed(0)})</span></span>
          </div>
          <div>
            {isSimulating && <span className="text-green-400 font-semibold animate-pulse">● Simulation Running</span>}
          </div>
        </div>
      </div>

      <div className="w-72 bg-gray-800 p-4 overflow-y-auto border-l border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Properties
        </h2>

        {selectedComponent ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-400">Component</label>
              <div className="p-2 bg-gray-700 rounded font-semibold">{selectedComponent.label}</div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-400">Type</label>
              <div className="p-2 bg-gray-700 rounded text-gray-300">{selectedComponent.type}</div>
            </div>

            {(selectedComponent.type === "resistor" || selectedComponent.type === "capacitor") && (
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-400">Value</label>
                <input
                  type="text"
                  value={String(selectedComponent.value ?? "")}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setComponents((prev) => prev.map((c) => (c.id === selectedComponent.id ? { ...c, value: newValue } : c)));
                    setSelectedComponent((prev) => (prev ? { ...prev, value: newValue } : prev));
                  }}
                  className="w-full p-2 bg-gray-700 rounded text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-400">Position</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">X</label>
                  <input
                    type="number"
                    value={Math.round(selectedComponent.x)}
                    onChange={(e) => {
                      const x = parseInt(e.target.value) || 0;
                      setComponents((prev) => prev.map((c) => (c.id === selectedComponent.id ? { ...c, x } : c)));
                      setSelectedComponent((prev) => (prev ? { ...prev, x } : prev));
                    }}
                    className="w-full p-1 bg-gray-700 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedComponent.y)}
                    onChange={(e) => {
                      const y = parseInt(e.target.value) || 0;
                      setComponents((prev) => prev.map((c) => (c.id === selectedComponent.id ? { ...c, y } : c)));
                      setSelectedComponent((prev) => (prev ? { ...prev, y } : prev));
                    }}
                    className="w-full p-1 bg-gray-700 rounded text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-400">Rotation</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={90}
                  value={selectedComponent.rotation ?? 0}
                  onChange={(e) => {
                    const rotation = parseInt(e.target.value);
                    setComponents((prev) => prev.map((c) => (c.id === selectedComponent.id ? { ...c, rotation } : c)));
                    setSelectedComponent((prev) => (prev ? { ...prev, rotation } : prev));
                  }}
                  className="flex-1"
                />
                <span className="text-sm font-mono">{selectedComponent.rotation ?? 0}°</span>
              </div>
            </div>

            {selectedComponent.type === "led" && (
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-400">LED Color</label>
                <input
                  type="color"
                  value={selectedComponent.color ?? "#ff0000"}
                  onChange={(e) => {
                    const color = e.target.value;
                    setComponents((prev) => prev.map((c) => (c.id === selectedComponent.id ? { ...c, color } : c)));
                    setSelectedComponent((prev) => (prev ? { ...prev, color } : prev));
                  }}
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                />
              </div>
            )}

            {isSimulating && measurements[selectedComponent.id] && (
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-400">Measurement</label>
                <div className="p-3 bg-green-900 rounded text-green-200 font-mono text-lg text-center">{measurements[selectedComponent.id]}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            <p className="mb-2">No component selected</p>
            <p className="text-sm">Click a component to view and edit its properties</p>
          </div>
        )}

        {isSimulating && (
          <div className="mt-6 p-4 bg-gradient-to-br from-green-900 to-blue-900 rounded-lg border border-green-700">
            <h3 className="font-bold mb-3 text-green-300 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              Live Simulation Data
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-black bg-opacity-30 rounded">
                <span className="text-gray-300">Voltage:</span>
                <span className="font-mono text-green-400 font-bold">{simulationData.voltage}V</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-black bg-opacity-30 rounded">
                <span className="text-gray-300">Current:</span>
                <span className="font-mono text-yellow-400 font-bold">{simulationData.current}mA</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-black bg-opacity-30 rounded">
                <span className="text-gray-300">Power:</span>
                <span className="font-mono text-red-400 font-bold">{simulationData.power}mW</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded-lg text-sm border border-blue-700">
          <h3 className="font-bold mb-2 text-blue-300">Quick Guide</h3>
          <ul className="space-y-1 text-xs text-gray-300">
            <li>• <span className="font-semibold">Add:</span> Click components from left panel</li>
            <li>• <span className="font-semibold">Move:</span> Drag components around canvas</li>
            <li>• <span className="font-semibold">Wire:</span> Click wire button, then two pins</li>
            <li>• <span className="font-semibold">Delete:</span> Select component, press Delete</li>
            <li>• <span className="font-semibold">Simulate:</span> Click play to see live data</li>
            <li>• <span className="font-semibold">Save/Load:</span> Export and import circuits</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CircuitSimulator;
