import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Check,
  Link2,
  ImagePlus,
} from "lucide-react";
import type { Answer, PublicActivity } from "../../shared/domain";
import { RichText } from "./RichText";
interface Props {
  activity: PublicActivity;
  answer: Answer;
  onChange: (answer: Answer) => void;
  disabled?: boolean;
  onPhoto?: (file: File) => void;
}
export function emptyAnswer(a: PublicActivity): Answer {
  return a.type === "order"
    ? a.items!.map((i) => i.id)
    : ["match", "classify"].includes(a.type)
      ? {}
      : "";
}
export function ActivityInput({
  activity: a,
  answer,
  onChange,
  disabled = false,
  onPhoto,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const map =
    typeof answer === "object" && !Array.isArray(answer)
      ? (answer as Record<string, string>)
      : {};
  const select = (id: string) => {
    if (!disabled) setSelected(id);
  };
  function target(category: string) {
    if (!disabled && (dragging || selected)) {
      onChange({ ...map, [dragging || selected!]: category });
      setSelected(null);
      setDragging(null);
    }
  }
  if (a.type === "choice" || a.type === "boolean") {
    const opts = a.type === "boolean" ? ["Verdadeiro", "Falso"] : a.options!;
    return (
      <div className="answer-options">
        {opts.map((option, i) => {
          const value = a.type === "boolean" ? i === 0 : i;
          const active = answer === value;
          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              className={"answer-option " + (active ? "selected" : "")}
              aria-pressed={active}
              onClick={() => onChange(value)}
            >
              <span className="option-letter">
                {a.type === "boolean"
                  ? i === 0
                    ? "V"
                    : "F"
                  : String.fromCharCode(65 + i)}
              </span>
              <RichText>{option}</RichText>
              {active && <Check size={20} />}
            </button>
          );
        })}
      </div>
    );
  }
  if (a.type === "blank")
    return (
      <div className="blank-input">
        <label>
          Complete a lacuna
          <input
            autoComplete="off"
            value={String(answer)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Sua resposta"
          />
        </label>
        {!!a.bank?.length && (
          <div className="word-bank" aria-label="Banco de palavras">
            {a.bank.map((word) => (
              <button
                type="button"
                disabled={disabled}
                key={word}
                aria-pressed={answer === word}
                className={answer === word ? "chip active" : "chip"}
                onClick={() => onChange(word)}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  if (a.type === "numeric")
    return (
      <label className="numeric-input">
        Sua resposta
        <div className="input-unit">
          <input
            inputMode="decimal"
            autoComplete="off"
            value={String(answer)}
            placeholder="Digite um número"
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {a.unit && <span>{a.unit}</span>}
        </div>
        <span className="muted small">
          Use vírgula ou ponto para decimais. Digite apenas o número.
        </span>
      </label>
    );
  if (a.type === "open")
    return (
      <div className="open-input">
        <label>
          Desenvolva sua resposta
          <textarea
            rows={6}
            value={String(answer)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escreva seu raciocínio, explique ou justifique..."
          />
        </label>
        {onPhoto && (
          <label className="file-label">
            <ImagePlus size={18} /> Anexar foto da resolução
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={(e) => {
                if (e.target.files?.[0]) onPhoto(e.target.files[0]);
              }}
            />
          </label>
        )}
        <p className="small muted">
          A resposta será avaliada pelo responsável ou educador.
        </p>
      </div>
    );
  if (a.type === "match")
    return (
      <div>
        <p className="muted small">
          Selecione um item e escolha seu par. Você também pode arrastar.
        </p>
        <div className="matching-grid">
          <div>
            {a.pairs!.map((p) => (
              <button
                type="button"
                key={p.id}
                draggable={!disabled}
                disabled={disabled}
                onDragStart={() => setDragging(p.id)}
                onDragEnd={() => setDragging(null)}
                aria-pressed={selected === p.id}
                onClick={() => select(p.id)}
                className={
                  "match-item " + (selected === p.id ? "selected" : "")
                }
              >
                <span>{p.left}</span>
                {map[p.id] && (
                  <span className="match-result">
                    <Link2 size={14} />
                    {a.rightOptions!.find((r) => r.id === map[p.id])?.text}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div>
            {a.rightOptions!.map((p) => (
              <button
                type="button"
                key={p.id}
                disabled={disabled}
                className="match-target"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  target(p.id);
                }}
                onClick={() => target(p.id)}
              >
                {p.text}
              </button>
            ))}
          </div>
        </div>
        <div aria-live="polite" className="small muted">
          {selected
            ? "Agora escolha o par na coluna da direita."
            : Object.keys(map).length +
              " de " +
              a.pairs!.length +
              " pares associados."}
        </div>
      </div>
    );
  if (a.type === "order") {
    const order = Array.isArray(answer) ? answer : a.items!.map((i) => i.id);
    function move(from: number, to: number) {
      if (disabled || to < 0 || to >= order.length) return;
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    }
    return (
      <div>
        <p className="muted small">
          Arraste os itens ou use as setas para organizá-los.
        </p>
        <ol className="order-list">
          {order.map((id, i) => (
            <li
              key={id}
              draggable={!disabled}
              onDragStart={() => setDragging(id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) move(order.indexOf(dragging), i);
                setDragging(null);
              }}
            >
              <GripVertical size={18} className="muted" />
              <span className="order-number">{i + 1}</span>
              <span className="grow">
                {a.items!.find((item) => item.id === id)?.text}
              </span>
              <button
                type="button"
                className="icon-button"
                disabled={disabled || i === 0}
                aria-label={"Mover item " + (i + 1) + " para cima"}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={disabled || i === order.length - 1}
                aria-label={"Mover item " + (i + 1) + " para baixo"}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={17} />
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div>
      <p className="muted small">
        Selecione um item e toque no grupo de destino, ou arraste-o.
      </p>
      <div className="word-bank">
        {a.items!.map((item) => (
          <button
            type="button"
            key={item.id}
            draggable={!disabled}
            disabled={disabled}
            aria-pressed={selected === item.id}
            onDragStart={() => setDragging(item.id)}
            onDragEnd={() => setDragging(null)}
            onClick={() => select(item.id)}
            className={"chip " + (selected === item.id ? "active" : "")}
          >
            {item.text}
            {map[item.id] && <span className="small"> · {map[item.id]}</span>}
          </button>
        ))}
      </div>
      <div className="category-grid">
        {a.categories!.map((category) => (
          <button
            type="button"
            key={category}
            disabled={disabled}
            className="category-target"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              target(category);
            }}
            onClick={() => target(category)}
          >
            <strong>{category}</strong>
            {a
              .items!.filter((item) => map[item.id] === category)
              .map((item) => (
                <span className="category-item" key={item.id}>
                  {item.text}
                </span>
              ))}
          </button>
        ))}
      </div>
      <p className="small muted" aria-live="polite">
        {Object.keys(map).length +
          " de " +
          a.items!.length +
          " itens classificados."}
      </p>
    </div>
  );
}
