import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Volume2, Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
export function RichText({ children }: { children: string }) {
  return (
    <div className="rich-text">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { strict: "ignore", throwOnError: false }],
        ]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => <span>{alt ? "[" + alt + "]" : ""}</span>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
export function ReadAloud({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [text],
  );
  if (!("speechSynthesis" in window))
    return (
      <span className="muted small">
        Leitura em voz alta indisponível neste navegador.
      </span>
    );
  function start() {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  }
  return (
    <div className="speech-controls">
      <button type="button" className="text-button" onClick={start}>
        <Volume2 size={17} /> {speaking ? "Ler novamente" : "Ouvir texto"}
      </button>
      {speaking && (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label={paused ? "Continuar leitura" : "Pausar leitura"}
            onClick={() => {
              paused ? speechSynthesis.resume() : speechSynthesis.pause();
              setPaused(!paused);
            }}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Parar leitura"
            onClick={() => {
              speechSynthesis.cancel();
              setSpeaking(false);
            }}
          >
            <Square size={15} />
          </button>
        </>
      )}
    </div>
  );
}
