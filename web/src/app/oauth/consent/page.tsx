import { Suspense } from "react"

import { ConsentCard } from "./consent-card"

// claude.ai sends the user here (Site URL + /oauth/consent) with ?authorization_id=…
// when it connects to the MCP server.
export default function ConsentPage() {
  return (
    <div className="mx-auto max-w-md pt-8">
      <Suspense>
        <ConsentCard />
      </Suspense>
    </div>
  )
}
