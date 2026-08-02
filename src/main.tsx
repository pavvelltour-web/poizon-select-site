import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import "./styles.css"
import "./open-design.css"
import "./open-design-legal.css"
import "./open-design-react.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
