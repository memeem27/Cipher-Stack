import { useState, useMemo } from "react";

interface Encoding {
  name: string;
  description: string;
  encode: (input: string) => string;
}

const encodings: Encoding[] = [
  {
    name: "Base64",
    description: "Binary-to-text encoding using 64 printable characters",
    encode: (input) => {
      try {
        return btoa(unescape(encodeURIComponent(input)));
      } catch {
        return "[encoding error]";
      }
    },
  },
  {
    name: "Base64 URL-safe",
    description: "Base64 with + and / replaced for use in URLs",
    encode: (input) => {
      try {
        return btoa(unescape(encodeURIComponent(input)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
      } catch {
        return "[encoding error]";
      }
    },
  },
  {
    name: "ROT13",
    description: "Substitution cipher rotating letters by 13 positions",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      }),
  },
  {
    name: "ROT47",
    description: "Extended ROT cipher rotating printable ASCII characters by 47",
    encode: (input) =>
      input.replace(/[!-~]/g, (c) =>
        String.fromCharCode(((c.charCodeAt(0) - 33 + 47) % 94) + 33)
      ),
  },
  {
    name: "URL Encoding",
    description: "Percent-encodes special characters for use in URLs",
    encode: (input) => encodeURIComponent(input),
  },
  {
    name: "HTML Entities",
    description: "Encodes characters as HTML named or numeric entities",
    encode: (input) =>
      input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/[^\x00-\x7F]/g, (c) => `&#${c.charCodeAt(0)};`),
  },
  {
    name: "Hexadecimal",
    description: "Converts each character to its hex byte representation",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" "),
  },
  {
    name: "Binary",
    description: "Converts each character to 8-bit binary representation",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(2).padStart(8, "0"))
        .join(" "),
  },
  {
    name: "Octal",
    description: "Converts each character to its octal (base-8) representation",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(8).padStart(3, "0"))
        .join(" "),
  },
  {
    name: "Decimal (ASCII)",
    description: "Converts each character to its decimal ASCII code",
    encode: (input) =>
      Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(10))
        .join(" "),
  },
  {
    name: "Morse Code",
    description: "International Morse code representation",
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
      return input
        .toUpperCase()
        .split("")
        .map((c) => morse[c] ?? "?")
        .join(" ");
    },
  },
  {
    name: "Caesar Cipher (ROT3)",
    description: "Classic shift cipher shifting letters by 3 positions",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 3) % 26) + base);
      }),
  },
  {
    name: "Atbash",
    description: "Ancient cipher reversing the alphabet (A=Z, B=Y, etc.)",
    encode: (input) =>
      input.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)));
      }),
  },
  {
    name: "Unicode Escape",
    description: "JavaScript-style Unicode escape sequences",
    encode: (input) =>
      Array.from(input)
        .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
        .join(""),
  },
];

function copyToClipboard(text: string, onCopied: () => void) {
  navigator.clipboard.writeText(text).then(onCopied).catch(() => {});
}

function EncodingCard({ encoding, result }: { encoding: Encoding; result: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(result, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="encoding-card">
      <div className="encoding-card-header">
        <div>
          <h3 className="encoding-name">{encoding.name}</h3>
          <p className="encoding-desc">{encoding.description}</p>
        </div>
        <button
          className={`copy-btn ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="encoding-result">
        <code>{result || <span className="placeholder">Encoded output will appear here</span>}</code>
      </div>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const results = useMemo(
    () =>
      encodings.map((enc) => ({
        encoding: enc,
        result: input ? enc.encode(input) : "",
      })),
    [input]
  );

  const filtered = results.filter(({ encoding }) =>
    encoding.name.toLowerCase().includes(search.toLowerCase()) ||
    encoding.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="page">
      <header className="page-header">
        <div className="header-inner">
          <div className="logo-row">
            <div className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
            <div>
              <h1 className="site-title">Message Encoder</h1>
              <p className="site-subtitle">Encode text through multiple formats instantly</p>
            </div>
          </div>
        </div>
      </header>

      <section className="input-section">
        <div className="input-wrapper">
          <label className="input-label" htmlFor="message-input">
            Your Message
          </label>
          <textarea
            id="message-input"
            className="message-input"
            placeholder="Type your message here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            spellCheck={false}
          />
          <div className="input-meta">
            <span className="char-count">{input.length} characters</span>
            {input && (
              <button className="clear-btn" onClick={() => setInput("")}>
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="results-section">
        <div className="results-header">
          <h2 className="results-title">
            {encodings.length} Encodings
          </h2>
          <div className="search-wrapper">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              className="search-input"
              placeholder="Filter encodings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No encodings match your search.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {filtered.map(({ encoding, result }) => (
              <EncodingCard key={encoding.name} encoding={encoding} result={result} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
