import React, { useEffect } from "react";
import { inject } from "@vercel/analytics";

const App = () => {
  useEffect(() => {
    inject();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#0b0b0b",
        color: "#ffffff",
        textAlign: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2 }}>
          Sorry. Page down for maintenance.
        </div>
      </div>
    </div>
  );
};

export default App;