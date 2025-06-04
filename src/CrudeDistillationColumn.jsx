import React, { useState } from "react";

import { performNR_RRFlash } from "./FlashCalcs.js";
import { performPR_EOS_RRFlash } from "./FlashCalcs.js";

const crudeOptions = [
  "Arab Light",
  "Brent",
  "Western Canadian Select",
  "West Texas Intermediate",
  "Venezuelan Heavy",
];

const feedComponents = [
  "Methane",
  "Ethane",
  "Propane",
  "n-Butane",
  "n-Pentane",
  "n-Hexane",
  "n-Heptane",
  "n-Octane",
];

const crudeCompositions = {
  "Arab Light": [0.05, 0.15, 0.18, 0.12, 0.18, 0.18, 0.12, 0.02],
  Brent: [0.06, 0.17, 0.19, 0.14, 0.19, 0.15, 0.08, 0.02],
  "Western Canadian Select": [0.02, 0.07, 0.11, 0.08, 0.15, 0.25, 0.3, 0.02],
  "West Texas Intermediate": [0.07, 0.18, 0.2, 0.14, 0.2, 0.12, 0.07, 0.02],
  "Venezuelan Heavy": [0.03, 0.08, 0.1, 0.12, 0.2, 0.25, 0.2, 0.02],
};

const columnX = 150;
const columnWidth = 200;
const columnTopY = 90;
const trayHeight = 24;
const totalTrays = 32;
const feedTrayIndex = 28;
const feedY = columnTopY + feedTrayIndex * trayHeight;

const CrudeDistillationColumn = () => {
  const [selectedCrude, setSelectedCrude] = useState("Western Canadian Select");
  const [feedCompositions, setFeedCompositions] = useState(
    crudeCompositions["Western Canadian Select"].map((val) => val.toFixed(2))
  );

  const [feedRate, setFeedRate] = useState("100000");
  const [result, setResult] = useState(null);

  const [trayInfo, setTrayInfo] = useState(Array(totalTrays).fill(""));

  const [lastFlashType, setLastFlashType] = useState(null);

  const handleCrudeChange = (e) => {
    const selected = e.target.value;
    setSelectedCrude(selected);
    const comp = crudeCompositions[selected] || Array(8).fill(0.0);
    setFeedCompositions(comp.map((val) => val.toFixed(2)));
    setResult(null);
    setTrayInfo(Array(totalTrays).fill("")); // Clear tray display
    setLastFlashType(null); // Reset flash button color
  };

  const handleFeedCompChange = (index, value) => {
    const updated = [...feedCompositions];
    updated[index] = value;
    setFeedCompositions(updated);
    setResult(null);
    setTrayInfo(Array(totalTrays).fill("")); // Clear tray display
    setLastFlashType(null); // Reset flash button color
  };

  const runFlashCalculation = (type) => {
    const x = feedCompositions.map(parseFloat);
    const z = x.reduce((a, b) => a + b, 0);
    if (isNaN(z) || z <= 0) {
      setResult("Invalid composition input");
      return;
    }
    const xNorm = x.map((xi) => xi / z);

    setLastFlashType(type);

    let flashResult;

    if (type === "Newton-Raphson") {
      flashResult = performNR_RRFlash(xNorm);
    } else if (type === "Peng-Robinson") {
      flashResult = performPR_EOS_RRFlash(xNorm);
    } else {
      setResult("Invalid flash type selected.");
      return;
    }

    if (flashResult.message) {
      setResult(flashResult.message);
    } else {
      let resultText = "Flash Results (Vapor Phase):\n";
      for (let i = 0; i < flashResult.vaporPhase.length; i++) {
        resultText += `${feedComponents[i]}: ${(
          flashResult.vaporPhase[i] * 100
        ).toFixed(1)}%\n`;
      }

      resultText += "\nFlash Results (Liquid Phase):\n";
      for (let i = 0; i < flashResult.liquidPhase.length; i++) {
        resultText += `${feedComponents[i]}: ${(
          flashResult.liquidPhase[i] * 100
        ).toFixed(1)}%\n`;
      }

      setResult(resultText);

      const allZeroVapor = flashResult.vaporPhase.every((val) => val === 0);
      const allZeroLiquid = flashResult.liquidPhase.every((val) => val === 0);

      if (!allZeroVapor || !allZeroLiquid) {
        const drawdownTrays = [0, 4, 9, 14, 19, 24, 29];
        const V = flashResult.vaporFraction;
        const L = 1.0 - V;

        const totalVaporFlow = V * parseFloat(feedRate);
        const totalLiquidFlow = L * parseFloat(feedRate);

        const sumVaporDraw = flashResult.vaporPhase[0];
        let sumLiquidDraw = 0.0;
        for (let i = 1; i < drawdownTrays.length; i++) {
          sumLiquidDraw += flashResult.liquidPhase[i];
        }

        const trayFlows = Array(totalTrays).fill(0.0);

        // Vapor draw (overhead)
        trayFlows[drawdownTrays[0]] =
          (flashResult.vaporPhase[0] / sumVaporDraw) * totalVaporFlow;

        // Liquid draw trays
        for (let i = 1; i < drawdownTrays.length; i++) {
          const trayIndex = drawdownTrays[i];
          trayFlows[trayIndex] =
            (flashResult.liquidPhase[i] / sumLiquidDraw) * totalLiquidFlow;
        }

        const formatPercentage = (val) => `${(val * 100).toFixed(0)}%`;
        const formatNumber = (val) => `${val.toFixed(0)}`;

        const newTrayInfo = Array(totalTrays).fill("");
        newTrayInfo[0] = `Tray 1: Overhead vapor (C1–C4)        ~${formatPercentage(
          flashResult.vaporPhase[0]
        )} @ ~140°C     ${formatNumber(trayFlows[0])} BBL/day`;
        newTrayInfo[4] = `Tray 5: Light Naphtha draw-off        ~${formatPercentage(
          flashResult.liquidPhase[1]
        )} @ ~110°C     ${formatNumber(trayFlows[4])} BBL/day`;
        newTrayInfo[9] = `Tray 10: Heavy Naphtha draw-off       ~${formatPercentage(
          flashResult.liquidPhase[2]
        )} @ ~150°C     ${formatNumber(trayFlows[9])} BBL/day`;
        newTrayInfo[14] = `Tray 15: Kerosene draw-off            ~${formatPercentage(
          flashResult.liquidPhase[3]
        )} @ ~190°C     ${formatNumber(trayFlows[14])} BBL/day`;
        newTrayInfo[19] = `Tray 20: Diesel draw-off              ~${formatPercentage(
          flashResult.liquidPhase[4]
        )} @ ~250°C     ${formatNumber(trayFlows[19])} BBL/day`;
        newTrayInfo[24] = `Tray 25: Gas Oil draw-off             ~${formatPercentage(
          flashResult.liquidPhase[5]
        )} @ ~300°C     ${formatNumber(trayFlows[24])} BBL/day`;
        newTrayInfo[29] = `Tray 30+: Atmospheric Residue         ~${formatPercentage(
          flashResult.liquidPhase[6]
        )} @ ~360°C     ${formatNumber(trayFlows[29])} BBL/day`;

        setTrayInfo(newTrayInfo);
      }
    }
  };

  const sharedInputStyle = { fontFamily: "inherit" };

  return (
    <div
      style={{
        fontFamily: "Consolas, monospace",
        padding: "10px",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>
        Simple Crude Atmospheric Distillation Column Flash
      </h2>

      <div
        style={{
          display: "flex",
          gap: "20px",
          position: "relative",
          justifyContent: "center",
          textAlign: "left", // reset child layout back to left-align
        }}
      >
        <div style={{ width: "370px" }}>
          <div
            style={{
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label style={{ marginRight: "10px" }}>Select Crude Oil:</label>
            <select
              value={selectedCrude}
              onChange={handleCrudeChange}
              style={{ flex: 1, ...sharedInputStyle }}
            >
              {crudeOptions.map((opt, i) => (
                <option key={i} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "10px", marginTop: "0px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                marginTop: "-3px",
              }}
            >
              Feed composition:
            </label>
            {feedComponents.map((comp, i) => (
              <div key={i} style={{ display: "flex", marginBottom: "5px" }}>
                <label style={{ width: "130px" }}>{comp}</label>
                <input
                  type="text" // changed from "number"
                  value={feedCompositions[i]}
                  onChange={(e) => handleFeedCompChange(i, e.target.value)}
                  style={{ width: "60px", ...sharedInputStyle }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "5px" }}>
            <button
              style={{
                width: "90%",
                marginBottom: "5px",
                color: lastFlashType === "Newton-Raphson" ? "red" : "black",
                ...sharedInputStyle,
              }}
              onClick={() => runFlashCalculation("Newton-Raphson")}
            >
              Run Newton Rhapson/Rachford-Rice Flash
            </button>

            <button
              style={{
                width: "90%",
                color: lastFlashType === "Peng-Robinson" ? "red" : "black",
                ...sharedInputStyle,
              }}
              onClick={() => runFlashCalculation("Peng-Robinson")}
            >
              Run Peng Robinson EOS/Rachford-Rice Flash
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              left: columnX - 140,
              top: feedY + trayHeight / 2 + 15,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontFamily: "Consolas, monospace",
            }}
          >
            <label style={{ whiteSpace: "nowrap" }}>Crude feed BBL/day:</label>
            <input
              type="text" // changed from "number"
              value={feedRate}
              onChange={(e) => {
                setFeedRate(e.target.value);
                setResult(null);
                setTrayInfo(Array(totalTrays).fill(""));
                setLastFlashType(null); // Reset flash button color
              }}
              style={{ width: "100px", ...sharedInputStyle }}
            />
          </div>

          {result && (
            <pre
              style={{
                marginTop: "10px",
                whiteSpace: "pre-wrap",
                fontFamily: "Consolas, monospace",
              }}
            >
              {result}
            </pre>
          )}
        </div>

        <div style={{ position: "relative", width: 1000, height: 1000 }}>
          <div
            style={{
              position: "absolute",
              left: columnX,
              top: columnTopY,
              width: columnWidth,
            }}
          >
            {[...Array(totalTrays)].map((_, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div
                  style={{
                    height: trayHeight,
                    border: "1px solid black",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "16px",
                    paddingLeft: "5px",
                    fontFamily: "Consolas, monospace",
                  }}
                >
                  #{i + 1}
                </div>
                {trayInfo[i] && (
                  <div
                    style={{
                      position: "absolute",
                      left: columnWidth + 10,
                      top: 0,
                      whiteSpace: "nowrap",
                      fontSize: "16px",
                      color: "black",
                      fontFamily: "Consolas, monospace",
                    }}
                  >
                    {trayInfo[i]}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ position: "absolute", left: columnX, top: 0 }}>
            Cooling Section
          </div>
          <div style={{ position: "absolute", left: columnX, top: 20 }}>
            Overhead Vapor -&gt; Overhead Condenser (Tray 1)
          </div>
          <div style={{ position: "absolute", left: columnX, top: 40 }}>
            Condensed Light Naphtha + Reflux -&gt; Reflux Drum
          </div>
          <div
            style={{
              position: "absolute",
              left: columnX,
              top: columnTopY - 25,
              color: "red",
            }}
          >
            Top of Column (~120–150 °C)
          </div>
          <div
            style={{
              position: "absolute",
              left: columnX,
              top: columnTopY + 50 + totalTrays * trayHeight + 5,
              color: "red",
            }}
          >
            Bottom of Column (~350–370 °C)
          </div>

          <div
            style={{
              position: "absolute",
              left: columnX - 203,
              top: feedY + trayHeight / 2 + 8,
              display: "flex",
              alignItems: "center",
              color: "red",
            }}
          >
            <div style={{ marginRight: "10px" }}>Crude Oil Feed Inlet</div>
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: "15px solid red",
              }}
            ></div>
          </div>

          <div
            style={{
              position: "absolute",
              left: columnX + columnWidth / 2 - 17,
              top: columnTopY + totalTrays * trayHeight - 60,
              width: 2,
              height: 190,
              backgroundColor: "red",
            }}
          ></div>

          <div
            style={{
              position: "absolute",
              left: columnX + columnWidth / 2 - 50,
              top: columnTopY + totalTrays * trayHeight + 130,
              width: 70,
              height: 30,
              border: "1px solid red",
              textAlign: "center",
              lineHeight: "30px",
              color: "red",
            }}
          >
            Furnace
          </div>

          <div
            style={{
              position: "absolute",
              left: columnX + columnWidth / 2 - 100,
              top: columnTopY + totalTrays * trayHeight + 95,
              color: "red",
            }}
          >
            Crude Oil Feed Preheater
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrudeDistillationColumn;
