import React from "react";

export default function App() {
  const box: React.CSSProperties = {
    margin: "40px auto",
    maxWidth: 600,
    padding: 16,
    border: "2px solid #0ea5e9",
    borderRadius: 12,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  };

  return (
    <div style={box}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Civils Déplacés v6</h1>
      <p style={{ marginTop: 12 }}>
        Si tu vois ce texte, la publication GitHub Pages marche ✅
      </p>
      <p style={{ marginTop: 8, color: "#b91c1c" }}>
        Crédit de 1 RCJ au titre du DP sur le R
      </p>
      <p style={{ marginTop: 4, color: "#b91c1c" }}>
        Crédit de 1,5 ou 2 RCJ + 1 RL au titre du DP sur le RH
      </p>
    </div>
  );
}
