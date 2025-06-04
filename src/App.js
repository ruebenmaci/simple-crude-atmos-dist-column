// DistillationApp.jsx
import React, { useState } from "react";
import CrudeDistillationColumn from "./CrudeDistillationColumn";

const crudeCompositions = {
  "Arab Light": [0.05, 0.15, 0.18, 0.12, 0.18, 0.18, 0.12, 0.02],
  Brent: [0.06, 0.17, 0.19, 0.14, 0.19, 0.15, 0.08, 0.02],
  "Western Canadian Select": [0.02, 0.07, 0.11, 0.08, 0.15, 0.25, 0.3, 0.02],
  "West Texas Intermediate": [0.07, 0.18, 0.2, 0.14, 0.2, 0.12, 0.07, 0.02],
  "Venezuelan Heavy": [0.03, 0.08, 0.1, 0.12, 0.2, 0.25, 0.2, 0.02],
};

function App() {
  const [selectedCrude, setSelectedCrude] = useState("Western Canadian Select");
  const [feedCompositions, setFeedCompositions] = useState(
    crudeCompositions["Western Canadian Select"].map((v) => v.toFixed(2))
  );
  const [feedRate, setFeedRate] = useState("100000");

  // When crude changes, update feed compositions to preset values
  const handleCrudeChange = (newCrude) => {
    setSelectedCrude(newCrude);
    const comp = crudeCompositions[newCrude] || Array(8).fill(0);
    setFeedCompositions(comp.map((v) => v.toFixed(2)));
  };

  // Update feed composition for a specific component
  const handleFeedCompChange = (index, value) => {
    const updated = [...feedCompositions];
    updated[index] = value;
    setFeedCompositions(updated);
  };

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <CrudeDistillationColumn
        selectedCrude={selectedCrude}
        onCrudeChange={handleCrudeChange}
        feedCompositions={feedCompositions}
        onFeedCompChange={handleFeedCompChange}
        feedRate={feedRate}
        onFeedRateChange={setFeedRate}
      />
    </div>
  );
}

export default App;
