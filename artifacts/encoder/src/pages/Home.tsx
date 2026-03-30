import { useState, useMemo, useRef, useCallback, useId } from "react";

/* ─── Types ────────────────────────────────────────────────────── */

interface ParamDef {
  key: string;
  label: string;
  type: "select" | "number" | "text";
  options?: Array<{ label: string; value: number | string }>;
  min?: number;
  max?: number;
  default: number | string;
}

interface Encoding {
  name: string;
  description: string;
  color: string;
  category: string;
  params?: ParamDef[];
  encode: (input: string, params: Record<string, number | string>) => string;
}

interface ChainBlock {
  id: string;
  encodingName: string;
  params: Record<string, number | string>;
}

/* ─── Encodings ─────────────────────────────────────────────────── */

const encodings: Encoding[] = [
  {
    name: "Base64",
    description: "Binary-to-text using 64 printable characters",
    color: "#3b82f6",
    category: "Common",
    encode: (input) => {
      try { return btoa(unescape(encodeURIComponent(input))); }
      catch { return "[error]"; }
    },
  },
  {
    name: "Base64 URL-safe",
    description: "Base64 safe for use inside URLs",
    color: "#2563eb",
    category: "Common",
    encode: (input) => {
      try {
        return btoa(unescape(encodeURIComponent(input)))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      } catch { return "[error]"; }
    },
  },
  {
    name: "URL Encoding",
    description: "Percent-encodes characters for URLs",
    color: "#0ea5e9",
    category: "Common",
    encode: (input) => encodeURIComponent(input),
  },
  {
    name: "HTML Entities",
    description: "Encodes characters as HTML entities",
    color: "#06b6d4",
    category: "Common",
    encode: (input) =>
      input
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
        .replace(/[^\x00-\x7F]/g, (c) => `&#${c.charCodeAt(0)};`),
  },
  {
    name: "ROT13",
    description: "Substitution cipher rotating letters by 13",
    color: "#8b5cf6",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      }),
  },
  {
    name: "Caesar Cipher",
    description: "Classic letter shift cipher",
    color: "#7c3aed",
    category: "Cipher",
    params: [
      {
        key: "shift",
        label: "Shift",
        type: "select",
        options: Array.from({ length: 25 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
        default: 3,
      },
    ],
    encode: (input, params) => {
      const shift = Number(params.shift ?? 3);
      return input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
      });
    },
  },
  {
    name: "Vigenère",
    description: "Polyalphabetic cipher using a keyword",
    color: "#a855f7",
    category: "Cipher",
    params: [
      { key: "key", label: "Key", type: "text", default: "KEY" },
    ],
    encode: (input, params) => {
      const key = String(params.key || "KEY").toUpperCase().replace(/[^A-Z]/g, "") || "A";
      let ki = 0;
      return input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        const shift = key.charCodeAt(ki % key.length) - 65;
        ki++;
        return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
      });
    },
  },
  {
    name: "Atbash",
    description: "Reverses the alphabet (A↔Z, B↔Y…)",
    color: "#d946ef",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
      }),
  },
  {
    name: "ROT47",
    description: "Rotates printable ASCII characters",
    color: "#ec4899",
    category: "Cipher",
    params: [
      {
        key: "shift",
        label: "Shift",
        type: "select",
        options: Array.from({ length: 93 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
        default: 47,
      },
    ],
    encode: (input, params) => {
      const shift = Number(params.shift ?? 47);
      return input.replace(/[!-~]/g, (c) =>
        String.fromCharCode(((c.charCodeAt(0) - 33 + shift) % 94) + 33)
      );
    },
  },
  {
    name: "Hexadecimal",
    description: "Each byte as hex",
    color: "#10b981",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(16).padStart(2, "0")).join(" "),
  },
  {
    name: "Binary",
    description: "Each byte as 8-bit binary",
    color: "#059669",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(2).padStart(8, "0")).join(" "),
  },
  {
    name: "Octal",
    description: "Each byte as octal (base-8)",
    color: "#16a34a",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(8).padStart(3, "0")).join(" "),
  },
  {
    name: "Decimal",
    description: "Each byte as a decimal number",
    color: "#15803d",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(10)).join(" "),
  },
  {
    name: "Morse Code",
    description: "International Morse representation",
    color: "#f59e0b",
    category: "Other",
    encode: (input) => {
      const morse: Record<string, string> = {
        A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",
        J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",
        S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",
        "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....",
        "6":"-....","7":"--...","8":"---.","9":"----.",
        ".":".-.-.-",",":"--..--","?":"..--..","!":"-.-.--","/":"-..-."," ":"/"
      };
      return input.toUpperCase().split("").map((c) => morse[c] ?? "?").join(" ");
    },
  },
  {
    name: "Unicode Escape",
    description: "JS-style \\uXXXX sequences",
    color: "#ef4444",
    category: "Other",
    encode: (input) =>
      Array.from(input)
        .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join(""),
  },
];

const CATEGORIES = ["Common", "Cipher", "Binary", "Other"];

/* ─── Helpers ───────────────────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultParams(enc: Encoding): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const p of enc.params ?? []) out[p.key] = p.default;
  return out;
}

function truncate(s: string, n = 40) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/* ─── Small icons ───────────────────────────────────────────────── */

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DragHandle() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" className="drag-handle-icon">
      {[0,6,12].map(y => (
        <g key={y}>
          <circle cx="3" cy={y+3} r="1.5" />
          <circle cx="9" cy={y+3} r="1.5" />
        </g>
      ))}
    </svg>
  );
}

/* ─── ChainBlockItem ────────────────────────────────────────────── */

interface ChainBlockItemProps {
  block: ChainBlock;
  index: number;
  stageInput: string;
  stageOutput: string;
  isDropTarget: boolean;
  dropPosition: "before" | "after" | null;
  onRemove: (id: string) => void;
  onParamChange: (id: string, key: string, value: number | string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
}

function ChainBlockItem({
  block, index, stageInput, stageOutput, isDropTarget, dropPosition,
  onRemove, onParamChange, onDragStart, onDragOver,
}: ChainBlockItemProps) {
  const enc = encodings.find((e) => e.name === block.encodingName)!;

  return (
    <div
      className={`chain-slot ${isDropTarget && dropPosition === "before" ? "drop-before" : ""} ${isDropTarget && dropPosition === "after" ? "drop-after" : ""}`}
      onDragOver={(e) => onDragOver(e, index)}
    >
      <div
        className="chain-block-item"
        style={{ "--c": enc.color } as React.CSSProperties}
        draggable
        onDragStart={(e) => onDragStart(e, index)}
      >
        {/* Top tab (Scratch notch) */}
        <div className="chain-tab" />

        <div className="chain-block-body">
          <span className="chain-drag-handle">
            <DragHandle />
          </span>
          <span className="chain-block-name">{enc.name}</span>

          {/* Inline params */}
          {enc.params?.map((p) => (
            <span key={p.key} className="chain-param">
              <span className="chain-param-label">{p.label}</span>
              {p.type === "select" ? (
                <select
                  className="chain-param-select"
                  value={block.params[p.key]}
                  onChange={(e) => onParamChange(block.id, p.key, Number(e.target.value) || e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {p.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : p.type === "text" ? (
                <input
                  className="chain-param-text"
                  type="text"
                  value={String(block.params[p.key] ?? p.default)}
                  onChange={(e) => onParamChange(block.id, p.key, e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  maxLength={32}
                />
              ) : (
                <input
                  className="chain-param-number"
                  type="number"
                  value={Number(block.params[p.key] ?? p.default)}
                  min={p.min}
                  max={p.max}
                  onChange={(e) => onParamChange(block.id, p.key, Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              )}
            </span>
          ))}

          <button
            className="chain-remove-btn"
            onClick={() => onRemove(block.id)}
            title="Remove"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Preview strip */}
        {stageInput && (
          <div className="chain-preview">
            <span className="chain-preview-in">{truncate(stageInput, 28)}</span>
            <span className="chain-preview-arrow">→</span>
            <span className="chain-preview-out">{truncate(stageOutput, 28)}</span>
          </div>
        )}

        {/* Bottom notch */}
        <div className="chain-notch" />
      </div>
    </div>
  );
}

/* ─── PaletteBlock ──────────────────────────────────────────────── */

function PaletteBlock({ enc, onDragStart }: { enc: Encoding; onDragStart: (e: React.DragEvent, name: string) => void }) {
  return (
    <button
      className="palette-block"
      style={{ "--c": enc.color } as React.CSSProperties}
      draggable
      onDragStart={(e) => onDragStart(e, enc.name)}
      title={enc.description}
    >
      <span className="palette-notch" />
      <span className="palette-block-text">{enc.name}</span>
    </button>
  );
}

/* ─── Home ──────────────────────────────────────────────────────── */

export default function Home() {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState<ChainBlock[]>([]);
  const [dragSource, setDragSource] = useState<{ type: "palette"; name: string } | { type: "chain"; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "before" | "after" } | null>(null);
  const [droppingOnZone, setDroppingOnZone] = useState(false);
  const [copied, setCopied] = useState(false);
  const chainZoneRef = useRef<HTMLDivElement>(null);

  /* Pipeline computation */
  const stages = useMemo(() => {
    const result: string[] = [input];
    for (const block of chain) {
      const enc = encodings.find((e) => e.name === block.encodingName);
      if (enc) {
        const prev = result[result.length - 1];
        result.push(prev ? enc.encode(prev, block.params) : "");
      }
    }
    return result;
  }, [input, chain]);

  const output = stages[stages.length - 1] ?? "";

  /* Param update */
  const handleParamChange = useCallback((id: string, key: string, value: number | string) => {
    setChain((prev) => prev.map((b) => b.id === id ? { ...b, params: { ...b.params, [key]: value } } : b));
  }, []);

  /* Remove from chain */
  const handleRemove = useCallback((id: string) => {
    setChain((prev) => prev.filter((b) => b.id !== id));
  }, []);

  /* Drag start from palette */
  const handlePaletteDragStart = useCallback((e: React.DragEvent, name: string) => {
    e.dataTransfer.setData("type", "palette");
    e.dataTransfer.setData("name", name);
    e.dataTransfer.effectAllowed = "copy";
    setDragSource({ type: "palette", name });
  }, []);

  /* Drag start from chain */
  const handleChainDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("type", "chain");
    e.dataTransfer.setData("index", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ type: "chain", index });
  }, []);

  /* Drag over a chain block slot */
  const handleChainBlockDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";
    setDropTarget({ index, position });
    setDroppingOnZone(false);
  }, []);

  /* Drag over the empty zone itself */
  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDroppingOnZone(true);
    setDropTarget(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the zone entirely
    if (!chainZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
      setDroppingOnZone(false);
    }
  }, []);

  /* Drop onto the chain zone */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");

    // Compute insertion index
    let insertAt = chain.length; // default: end
    if (dropTarget !== null) {
      insertAt = dropTarget.position === "before" ? dropTarget.index : dropTarget.index + 1;
    }

    if (type === "palette") {
      const name = e.dataTransfer.getData("name");
      const enc = encodings.find((e) => e.name === name);
      if (enc) {
        const newBlock: ChainBlock = { id: uid(), encodingName: name, params: defaultParams(enc) };
        setChain((prev) => {
          const next = [...prev];
          next.splice(insertAt, 0, newBlock);
          return next;
        });
      }
    } else if (type === "chain") {
      const fromIndex = Number(e.dataTransfer.getData("index"));
      setChain((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        const adjustedInsert = insertAt > fromIndex ? insertAt - 1 : insertAt;
        next.splice(adjustedInsert, 0, moved);
        return next;
      });
    }

    setDropTarget(null);
    setDroppingOnZone(false);
    setDragSource(null);
  }, [chain.length, dropTarget]);

  const handleDragEnd = useCallback(() => {
    setDragSource(null);
    setDropTarget(null);
    setDroppingOnZone(false);
  }, []);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <main className="page" onDragEnd={handleDragEnd}>
      <header className="page-header">
        <div className="logo-row">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <div>
            <h1 className="site-title">Message Encoder</h1>
            <p className="site-subtitle">Drag encoding blocks into the pipeline to chain multiple encodings</p>
          </div>
        </div>
      </header>

      {/* ── Main pipeline row ── */}
      <section className="pipeline-row">

        {/* Input */}
        <div className="io-panel input-panel">
          <div className="panel-label">
            <span className="panel-dot" style={{ background: "#6c8ef5" }} />
            Input
          </div>
          <textarea
            className="io-textarea"
            placeholder="Type your message here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
          <div className="panel-footer">
            <span className="char-count">{input.length} chars</span>
            {input && <button className="clear-btn" onClick={() => setInput("")}>Clear</button>}
          </div>
        </div>

        {/* Flow arrow */}
        <div className="flow-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        {/* Chain zone */}
        <div
          ref={chainZoneRef}
          className={`chain-zone ${droppingOnZone && chain.length === 0 ? "drop-active" : ""} ${chain.length === 0 ? "empty" : ""}`}
          onDragOver={handleZoneDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="chain-zone-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            Pipeline
            {chain.length > 0 && <span className="chain-count">{chain.length}</span>}
          </div>

          {chain.length === 0 ? (
            <div className="chain-empty-state">
              <div className="chain-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                  <rect x="2" y="7" width="8" height="10" rx="2" />
                  <rect x="9" y="7" width="8" height="10" rx="2" />
                  <rect x="16" y="7" width="6" height="10" rx="2" />
                  <line x1="10" y1="12" x2="9" y2="12" /><line x1="17" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <p>Drag blocks here</p>
              <p className="chain-empty-sub">Stack multiple encodings in sequence</p>
            </div>
          ) : (
            <div className="chain-blocks">
              {chain.map((block, index) => (
                <ChainBlockItem
                  key={block.id}
                  block={block}
                  index={index}
                  stageInput={stages[index]}
                  stageOutput={stages[index + 1] ?? ""}
                  isDropTarget={dropTarget?.index === index}
                  dropPosition={dropTarget?.index === index ? dropTarget.position : null}
                  onRemove={handleRemove}
                  onParamChange={handleParamChange}
                  onDragStart={handleChainDragStart}
                  onDragOver={handleChainBlockDragOver}
                />
              ))}
              {/* Drop zone at end */}
              <div
                className={`chain-end-drop ${droppingOnZone ? "active" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDroppingOnZone(true); setDropTarget(null); }}
              />
            </div>
          )}
        </div>

        {/* Flow arrow */}
        <div className="flow-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        {/* Output */}
        <div className="io-panel output-panel">
          <div className="panel-label">
            <span className="panel-dot" style={{ background: chain.length > 0 ? (encodings.find(e => e.name === chain[chain.length - 1]?.encodingName)?.color ?? "#6c8ef5") : "#6c8ef5" }} />
            Output
            {chain.length === 0 && <span className="panel-hint"> — add a block</span>}
          </div>
          <div className="io-output">
            {output
              ? <code className="output-code">{output}</code>
              : <span className="output-placeholder">
                  {chain.length === 0 ? "Add encoding blocks to the pipeline" : "Type a message to see output"}
                </span>
            }
          </div>
          <div className="panel-footer">
            <span className="char-count">{output.length} chars</span>
            <button
              className={`copy-btn ${copied ? "copied" : ""} ${!output ? "disabled" : ""}`}
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Palette ── */}
      <section className="palette-section">
        <div className="palette-header">
          <h2 className="palette-title">Encoding Blocks</h2>
          <p className="palette-hint">Drag blocks into the pipeline above</p>
        </div>
        {CATEGORIES.map((cat) => {
          const group = encodings.filter((e) => e.category === cat);
          return (
            <div key={cat} className="palette-group">
              <div className="palette-group-label">{cat}</div>
              <div className="palette-row">
                {group.map((enc) => (
                  <PaletteBlock key={enc.name} enc={enc} onDragStart={handlePaletteDragStart} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
