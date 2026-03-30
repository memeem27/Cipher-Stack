import { useState, useMemo } from "react";

interface Encoding {
  name: string;
  description: string;
  color: string;
  category: string;
  encode: (input: string) => string;
}

const encodings: Encoding[] = [
  {
    name: "Base64",
    description: "Binary-to-text encoding using 64 printable characters",
    color: "#3b82f6",
    category: "Common",
    encode: (input) => {
      try { return btoa(unescape(encodeURIComponent(input))); }
      catch { return "[encoding error]"; }
    },
  },
  {
    name: "Base64 URL-safe",
    description: "Base64 with + and / replaced for use in URLs",
    color: "#2563eb",
    category: "Common",
    encode: (input) => {
      try {
        return btoa(unescape(encodeURIComponent(input)))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      } catch { return "[encoding error]"; }
    },
  },
  {
    name: "URL Encoding",
    description: "Percent-encodes special characters for use in URLs",
    color: "#0ea5e9",
    category: "Common",
    encode: (input) => encodeURIComponent(input),
  },
  {
    name: "HTML Entities",
    description: "Encodes characters as HTML named or numeric entities",
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
    description: "Substitution cipher rotating letters by 13 positions",
    color: "#8b5cf6",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      }),
  },
  {
    name: "ROT47",
    description: "Rotates all printable ASCII characters by 47 positions",
    color: "#7c3aed",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[!-~]/g, (c) =>
        String.fromCharCode(((c.charCodeAt(0) - 33 + 47) % 94) + 33)
      ),
  },
  {
    name: "Caesar Cipher",
    description: "Classic shift cipher shifting letters by 3 positions",
    color: "#a855f7",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 3) % 26) + base);
      }),
  },
  {
    name: "Atbash",
    description: "Ancient cipher reversing the alphabet (A=Z, B=Y, etc.)",
    color: "#d946ef",
    category: "Cipher",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)));
      }),
  },
  {
    name: "Hexadecimal",
    description: "Converts each character to its hex byte representation",
    color: "#10b981",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" "),
  },
  {
    name: "Binary",
    description: "Converts each character to 8-bit binary representation",
    color: "#059669",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(2).padStart(8, "0"))
        .join(" "),
  },
  {
    name: "Octal",
    description: "Converts each character to its octal (base-8) representation",
    color: "#16a34a",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(8).padStart(3, "0"))
        .join(" "),
  },
  {
    name: "Decimal (ASCII)",
    description: "Converts each character to its decimal ASCII code",
    color: "#15803d",
    category: "Binary",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(10))
        .join(" "),
  },
  {
    name: "Morse Code",
    description: "International Morse code representation",
    color: "#f59e0b",
    category: "Other",
    encode: (input) => {
      const morse: Record<string, string> = {
        A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
        G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
        M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
        S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
        Y: "-.--", Z: "--..",
        "0": "-----", "1": ".----", "2": "..---", "3": "...--",
        "4": "....-", "5": ".....", "6": "-....", "7": "--...",
        "8": "---..", "9": "----.",
        ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--",
        "/": "-..-.", " ": "/",
      };
      return input.toUpperCase().split("").map((c) => morse[c] ?? "?").join(" ");
    },
  },
  {
    name: "Unicode Escape",
    description: "JavaScript-style Unicode escape sequences",
    color: "#ef4444",
    category: "Other",
    encode: (input) =>
      Array.from(input)
        .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
        .join(""),
  },
];

const categories = ["Common", "Cipher", "Binary", "Other"];

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [selectedName, setSelectedName] = useState("Base64");
  const [copied, setCopied] = useState(false);

  const selected = encodings.find((e) => e.name === selectedName) ?? encodings[0];
  const output = useMemo(() => input ? selected.encode(input) : "", [input, selected]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <main className="page">
      <header className="page-header">
        <div className="logo-row">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <div>
            <h1 className="site-title">Message Encoder</h1>
            <p className="site-subtitle">Select an encoding block below, then type your message</p>
          </div>
        </div>
      </header>

      {/* Top: Input + Output side by side */}
      <section className="io-section">
        <div className="io-panel input-panel">
          <div className="panel-label">
            <span className="panel-dot input-dot" />
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
            {input && (
              <button className="clear-btn" onClick={() => setInput("")}>Clear</button>
            )}
          </div>
        </div>

        <div className="io-arrow">
          <div className="arrow-label" style={{ color: selected.color }}>
            {selected.name}
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: selected.color }}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        <div className="io-panel output-panel">
          <div className="panel-label">
            <span className="panel-dot output-dot" style={{ background: selected.color }} />
            Output
          </div>
          <div className="io-output">
            {output
              ? <code className="output-code">{output}</code>
              : <span className="output-placeholder">Encoded output will appear here</span>
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

      {/* Bottom: Scratch-style encoding blocks */}
      <section className="blocks-section">
        <h2 className="blocks-title">Encoding Blocks</h2>
        {categories.map((cat) => {
          const group = encodings.filter((e) => e.category === cat);
          return (
            <div key={cat} className="block-group">
              <div className="block-group-label">{cat}</div>
              <div className="block-row">
                {group.map((enc) => {
                  const isActive = enc.name === selectedName;
                  return (
                    <button
                      key={enc.name}
                      className={`encoding-block ${isActive ? "active" : ""}`}
                      style={{
                        "--block-color": enc.color,
                        "--block-dark": enc.color + "cc",
                      } as React.CSSProperties}
                      onClick={() => setSelectedName(enc.name)}
                      title={enc.description}
                    >
                      {/* Scratch-like notch on the left */}
                      <span className="block-notch" />
                      <span className="block-text">{enc.name}</span>
                      {isActive && <span className="block-active-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
