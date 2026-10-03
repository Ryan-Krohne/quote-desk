"use client"

import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react"
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Minimal types for the Web Speech API, which TypeScript's DOM library does not include.
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }>>
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => SpeechRecognitionLike

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in the address bar, or type instead.",
  "service-not-allowed": "Microphone access is blocked. Allow it in the address bar, or type instead.",
  "no-speech": "No speech heard. Try again closer to the microphone.",
  "audio-capture": "No microphone found. Type instead.",
  network: "The speech service is not reachable. Type instead.",
}

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const subscribeNever = () => () => {}

type VoiceInputProps = {
  label: string
  placeholder?: string
  submitLabel?: string
  busy?: boolean
  onSubmit: (text: string) => Promise<boolean | void> | boolean | void
}

// Speak or type, then submit. Uses the browser's speech recognition (Chrome, Edge, Safari).
// The text box stays editable, so the owner can fix a misheard word before sending.
export function VoiceInput({ label, placeholder = "Speak or type…", submitLabel = "Send", busy = false, onSubmit }: VoiceInputProps) {
  const id = useId()
  const [text, setText] = useState("")
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState("")
  // True on the server, so the Speak button is in the first render and nothing jumps.
  const supported = useSyncExternalStore(subscribeNever, () => getRecognition() !== null, () => true)
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => () => recognition.current?.abort(), [])

  function startListening() {
    const Recognition = getRecognition()
    if (!Recognition) return
    setMessage("")
    // Speech is added after anything already typed.
    const typed = text.trim()
    const r = new Recognition()
    r.lang = "en-US"
    r.continuous = true
    r.interimResults = true
    // Rebuild from every result each time: interim results are replaced, not added to.
    r.onresult = (event) => {
      const spoken = Array.from(event.results, (result) => result[0].transcript).join(" ")
      setText(`${typed} ${spoken}`.replace(/\s+/g, " ").trim())
    }
    r.onerror = (event) => {
      if (event.error !== "aborted") setMessage(ERROR_MESSAGES[event.error] ?? `Voice input stopped (${event.error}). Type instead.`)
    }
    r.onend = () => setListening(false)
    recognition.current = r
    r.start()
    setListening(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    recognition.current?.abort()
    const value = text.trim()
    if (!value) return
    // Keep the text if the submit failed, so the owner does not have to say it again.
    const ok = await onSubmit(value)
    if (ok !== false) setText("")
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      <Textarea
        id={id}
        rows={3}
        className={cn("text-lg", listening && "border-primary ring-3 ring-primary/30")}
        placeholder={placeholder}
        readOnly={listening}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="min-h-5 text-sm" role="status">
        {listening ? (
          <span className="inline-flex items-center gap-2 font-medium text-primary">
            <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" /> Listening… click Stop when you finish.
          </span>
        ) : message ? (
          <span className="text-destructive">{message}</span>
        ) : !supported ? (
          <span className="text-muted-foreground">Voice input is not available in this browser. Type instead.</span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {supported && (
          <Button
            type="button"
            size="lg"
            variant={listening ? "destructive" : "outline"}
            aria-pressed={listening}
            disabled={busy}
            onClick={listening ? () => recognition.current?.stop() : startListening}
          >
            {listening ? <SquareIcon /> : <MicIcon />}
            {listening ? "Stop" : "Speak"}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={busy || !text.trim()}>
          {busy && <Loader2Icon className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
