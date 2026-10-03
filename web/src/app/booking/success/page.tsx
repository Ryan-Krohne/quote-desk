import { Suspense } from "react"

import { BookingConfirmation } from "./booking-confirmation"

// Stripe redirects here after the test-mode deposit, with ?session_id={CHECKOUT_SESSION_ID}.
export default function BookingSuccessPage() {
  return (
    <div className="mx-auto max-w-md pt-8">
      <Suspense>
        <BookingConfirmation />
      </Suspense>
    </div>
  )
}
