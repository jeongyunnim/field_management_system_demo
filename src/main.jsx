import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "./index.css"; // Tailwind - index.css
import "leaflet/dist/leaflet.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <head>
      <link rel="icon" type="image/svg+xml" href="/public/favicon.ico" />
      <title>Dynavista FMS</title>
    </head>
    <App />
  </StrictMode>
);
