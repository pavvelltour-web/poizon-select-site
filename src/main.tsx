import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { appPath } from "./landing/landing-data"
import "./styles.css"
import "./open-design.css"
import "./open-design-legal.css"
import "./open-design-react.css"

restoreStaticHostRoute()
redirectRootRelativeLinks()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

function restoreStaticHostRoute() {
  const redirectKey = "__kicksbase_static_redirect"
  let redirectedPath: string | null = null

  try {
    redirectedPath = window.sessionStorage.getItem(redirectKey)
    window.sessionStorage.removeItem(redirectKey)
  } catch {
    return
  }

  if (!redirectedPath || !redirectedPath.startsWith("/") || redirectedPath.startsWith("//")) return

  window.history.replaceState(window.history.state, "", appPath(redirectedPath))
}

function redirectRootRelativeLinks() {
  if (import.meta.env.BASE_URL === "/") return

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target
    if (!(target instanceof Element)) return

    const anchor = target.closest<HTMLAnchorElement>('a[href^="/"]')
    const href = anchor?.getAttribute("href")
    if (!anchor || !href || href.startsWith("//") || href.startsWith(import.meta.env.BASE_URL) || anchor.target) return

    event.preventDefault()
    window.location.assign(appPath(href))
  })
}
