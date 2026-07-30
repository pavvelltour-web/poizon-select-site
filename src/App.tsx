import { MotionConfig } from "motion/react"

import { LandingPage } from "./landing/landing-page"

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LandingPage />
    </MotionConfig>
  )
}
