import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { installFetchInterceptor } from "./utils/fetchInterceptor.js";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./index.css";

// The mouse wheel over a number box scrolls the page; it never changes the number
document.addEventListener("wheel", (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === "number" && document.activeElement === t) t.blur();
}, { passive: true });

installFetchInterceptor();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);