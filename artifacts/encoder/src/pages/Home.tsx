import { useState, useMemo, useRef, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────── */

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
  decode?: (input: string, params: Record<string, number | string>) => string;
}

interface ChainBlock {
  id: string;
  encodingName: string;
  params: Record<string, number | string>;
  mode: "encode" | "decode";
}

/* ─── Encodings ──────────────────────────────────────────────── */

const B32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32_CHARS[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_CHARS[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
}

function base32Decode(input: string): string {
  const s = input.toUpperCase().replace(/=/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const c of s) {
    const idx = B32_CHARS.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  try { return new TextDecoder().decode(new Uint8Array(bytes)); }
  catch { return "[decode error]"; }
}

const NATO: Record<string, string> = {
  A:"Alpha",B:"Bravo",C:"Charlie",D:"Delta",E:"Echo",F:"Foxtrot",G:"Golf",
  H:"Hotel",I:"India",J:"Juliet",K:"Kilo",L:"Lima",M:"Mike",N:"November",
  O:"Oscar",P:"Papa",Q:"Quebec",R:"Romeo",S:"Sierra",T:"Tango",U:"Uniform",
  V:"Victor",W:"Whiskey",X:"X-ray",Y:"Yankee",Z:"Zulu",
};
const NATO_REV = Object.fromEntries(Object.entries(NATO).map(([k, v]) => [v.toLowerCase(), k]));

const LEET: Record<string, string> = { a:"4",e:"3",i:"1",o:"0",t:"7",s:"5",l:"1",g:"9",b:"8" };
const LEET_REV: Record<string, string> = { "4":"a","3":"e","1":"i","0":"o","7":"t","5":"s","9":"g","8":"b" };

const MORSE: Record<string, string> = {
  A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",
  J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",
  S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",
  "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....",
  "6":"-....","7":"--...","8":"---.","9":"----.",
  ".":".-.-.-",",":"--..--","?":"..--..","!":"-.-.--","/":"-..-."," ":"/",
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function pigLatinEncode(word: string): string {
  const lower = word.toLowerCase();
  const m = lower.match(/^([^aeiou]*)([aeiou].*)$/);
  if (!m) return word;
  const [, cons, rest] = m;
  if (!cons) return word + "way";
  const isUp = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
  const root = (isUp ? rest[0].toUpperCase() + rest.slice(1) : rest) + cons.toLowerCase() + "ay";
  return root;
}

function pigLatinDecode(word: string): string {
  if (word.endsWith("way")) return word.slice(0, -3);
  const m = word.match(/^(.+?)([^aeiou]+)ay$/i);
  if (!m) return word;
  const [, body, cons] = m;
  return cons + body;
}

const encodings: Encoding[] = [
  /* ── Common ── */
  {
    name: "Base64",
    description: "Binary-to-text using 64 printable characters",
    color: "#3b82f6", category: "Common",
    encode: (i) => { try { return btoa(unescape(encodeURIComponent(i))); } catch { return "[error]"; } },
    decode: (i) => { try { return decodeURIComponent(escape(atob(i.trim()))); } catch { return "[decode error]"; } },
  },
  {
    name: "Base64 URL-safe",
    description: "Base64 safe for use inside URLs",
    color: "#2563eb", category: "Common",
    encode: (i) => { try { return btoa(unescape(encodeURIComponent(i))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,""); } catch { return "[error]"; } },
    decode: (i) => { try { const p = i.replace(/-/g,"+").replace(/_/g,"/"); return decodeURIComponent(escape(atob(p + "==".slice((p.length * 6 & 3) ? 0 : 2)))); } catch { return "[decode error]"; } },
  },
  {
    name: "Base32",
    description: "Base32 encoding (RFC 4648)",
    color: "#1d4ed8", category: "Common",
    encode: (i) => base32Encode(i),
    decode: (i) => base32Decode(i),
  },
  {
    name: "URL Encoding",
    description: "Percent-encodes characters for URLs",
    color: "#0ea5e9", category: "Common",
    encode: (i) => encodeURIComponent(i),
    decode: (i) => { try { return decodeURIComponent(i); } catch { return "[decode error]"; } },
  },
  {
    name: "HTML Entities",
    description: "Encodes characters as HTML entities",
    color: "#06b6d4", category: "Common",
    encode: (i) => i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/[^\x00-\x7F]/g, c => `&#${c.charCodeAt(0)};`),
    decode: (i) => {
      const ta = document.createElement("textarea");
      ta.innerHTML = i;
      return ta.value;
    },
  },

  /* ── Cipher ── */
  {
    name: "ROT13",
    description: "Rotate letters by 13 (self-inverse)",
    color: "#8b5cf6", category: "Cipher",
    encode: (i) => i.replace(/[a-zA-Z]/g, c => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0)-b+13)%26)+b); }),
    decode: (i) => i.replace(/[a-zA-Z]/g, c => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0)-b+13)%26)+b); }),
  },
  {
    name: "Caesar Cipher",
    description: "Classic letter shift cipher",
    color: "#7c3aed", category: "Cipher",
    params: [{ key: "shift", label: "Shift", type: "select", options: Array.from({length:25},(_,i)=>({label:String(i+1),value:i+1})), default: 3 }],
    encode: (i, p) => { const s = Number(p.shift??3); return i.replace(/[a-zA-Z]/g, c => { const b = c<="Z"?65:97; return String.fromCharCode(((c.charCodeAt(0)-b+s)%26)+b); }); },
    decode: (i, p) => { const s = 26-Number(p.shift??3); return i.replace(/[a-zA-Z]/g, c => { const b = c<="Z"?65:97; return String.fromCharCode(((c.charCodeAt(0)-b+s)%26)+b); }); },
  },
  {
    name: "Vigenère",
    description: "Polyalphabetic cipher using a keyword",
    color: "#a855f7", category: "Cipher",
    params: [{ key: "key", label: "Key", type: "text", default: "KEY" }],
    encode: (i, p) => {
      const key = String(p.key||"KEY").toUpperCase().replace(/[^A-Z]/g,"")||"A";
      let ki=0;
      return i.replace(/[a-zA-Z]/g, c => { const b=c<="Z"?65:97; const s=key.charCodeAt(ki++%key.length)-65; return String.fromCharCode(((c.charCodeAt(0)-b+s)%26)+b); });
    },
    decode: (i, p) => {
      const key = String(p.key||"KEY").toUpperCase().replace(/[^A-Z]/g,"")||"A";
      let ki=0;
      return i.replace(/[a-zA-Z]/g, c => { const b=c<="Z"?65:97; const s=26-(key.charCodeAt(ki++%key.length)-65); return String.fromCharCode(((c.charCodeAt(0)-b+s)%26)+b); });
    },
  },
  {
    name: "Atbash",
    description: "Reverses the alphabet (A↔Z, self-inverse)",
    color: "#d946ef", category: "Cipher",
    encode: (i) => i.replace(/[a-zA-Z]/g, c => { const b=c<="Z"?65:97; return String.fromCharCode(b+25-(c.charCodeAt(0)-b)); }),
    decode: (i) => i.replace(/[a-zA-Z]/g, c => { const b=c<="Z"?65:97; return String.fromCharCode(b+25-(c.charCodeAt(0)-b)); }),
  },
  {
    name: "ROT47",
    description: "Rotates printable ASCII characters",
    color: "#ec4899", category: "Cipher",
    params: [{ key: "shift", label: "Shift", type: "select", options: Array.from({length:93},(_,i)=>({label:String(i+1),value:i+1})), default: 47 }],
    encode: (i, p) => { const s=Number(p.shift??47); return i.replace(/[!-~]/g, c => String.fromCharCode(((c.charCodeAt(0)-33+s)%94)+33)); },
    decode: (i, p) => { const s=94-Number(p.shift??47); return i.replace(/[!-~]/g, c => String.fromCharCode(((c.charCodeAt(0)-33+s)%94)+33)); },
  },
  {
    name: "XOR Cipher",
    description: "XOR each byte with a repeating key",
    color: "#f43f5e", category: "Cipher",
    params: [{ key: "key", label: "Key", type: "text", default: "KEY" }],
    encode: (i, p) => {
      const key = String(p.key||"KEY");
      return Array.from(new TextEncoder().encode(i))
        .map((b,n) => (b^key.charCodeAt(n%key.length)).toString(16).padStart(2,"0"))
        .join(" ");
    },
    decode: (i, p) => {
      const key = String(p.key||"KEY");
      const bytes = i.trim().split(/\s+/).map(h => parseInt(h,16)).filter(n => !isNaN(n));
      try { return new TextDecoder().decode(new Uint8Array(bytes.map((b,n) => b^key.charCodeAt(n%key.length)))); }
      catch { return "[decode error]"; }
    },
  },

  /* ── Binary ── */
  {
    name: "Hexadecimal",
    description: "Each byte as hex",
    color: "#10b981", category: "Binary",
    encode: (i) => Array.from(new TextEncoder().encode(i)).map(b=>b.toString(16).padStart(2,"0")).join(" "),
    decode: (i) => { try { return new TextDecoder().decode(new Uint8Array(i.trim().split(/\s+/).map(h=>parseInt(h,16)))); } catch { return "[decode error]"; } },
  },
  {
    name: "Binary",
    description: "Each byte as 8-bit binary",
    color: "#059669", category: "Binary",
    encode: (i) => Array.from(new TextEncoder().encode(i)).map(b=>b.toString(2).padStart(8,"0")).join(" "),
    decode: (i) => { try { return new TextDecoder().decode(new Uint8Array(i.trim().split(/\s+/).map(b=>parseInt(b,2)))); } catch { return "[decode error]"; } },
  },
  {
    name: "Octal",
    description: "Each byte as octal (base-8)",
    color: "#16a34a", category: "Binary",
    encode: (i) => Array.from(new TextEncoder().encode(i)).map(b=>b.toString(8).padStart(3,"0")).join(" "),
    decode: (i) => { try { return new TextDecoder().decode(new Uint8Array(i.trim().split(/\s+/).map(b=>parseInt(b,8)))); } catch { return "[decode error]"; } },
  },
  {
    name: "Decimal",
    description: "Each byte as a decimal number",
    color: "#15803d", category: "Binary",
    encode: (i) => Array.from(new TextEncoder().encode(i)).map(b=>b.toString(10)).join(" "),
    decode: (i) => { try { return new TextDecoder().decode(new Uint8Array(i.trim().split(/\s+/).map(Number))); } catch { return "[decode error]"; } },
  },

  /* ── Transform ── */
  {
    name: "Reverse",
    description: "Reverses the entire string",
    color: "#f97316", category: "Transform",
    encode: (i) => Array.from(i).reverse().join(""),
    decode: (i) => Array.from(i).reverse().join(""),
  },
  {
    name: "Leet Speak",
    description: "Replaces letters with similar-looking numbers",
    color: "#ea580c", category: "Transform",
    encode: (i) => i.replace(/[aeiostlgb]/gi, c => LEET[c.toLowerCase()] ?? c),
    decode: (i) => i.replace(/[430715983]/g, c => LEET_REV[c] ?? c),
  },
  {
    name: "Pig Latin",
    description: "Classic word-game language transformation",
    color: "#dc2626", category: "Transform",
    encode: (i) => i.replace(/\b([a-zA-Z]+)\b/g, w => pigLatinEncode(w)),
    decode: (i) => i.replace(/\b([a-zA-Z]+(?:way|[^aeiou]+ay))\b/gi, w => pigLatinDecode(w)),
  },
  {
    name: "Letter Numbers",
    description: "Replace letters with their position (A=1, B=2…)",
    color: "#b45309", category: "Transform",
    encode: (i) => i.toUpperCase().replace(/[A-Z]/g, c => `[${c.charCodeAt(0)-64}]`),
    decode: (i) => i.replace(/\[(\d+)\]/g, (_, n) => { const num=Number(n); return num>=1&&num<=26?String.fromCharCode(64+num):_; }),
  },
  {
    name: "NATO Phonetic",
    description: "Spell out letters using NATO alphabet",
    color: "#92400e", category: "Transform",
    encode: (i) => i.toUpperCase().split("").map(c => NATO[c] ?? c).join(" "),
    decode: (i) => i.split(/\s+/).map(w => NATO_REV[w.toLowerCase()] ?? w).join(""),
  },

  /* ── Other ── */
  {
    name: "Morse Code",
    description: "International Morse representation",
    color: "#f59e0b", category: "Other",
    encode: (i) => i.toUpperCase().split("").map(c => MORSE[c] ?? "?").join(" "),
    decode: (i) => i.split(" / ").map(word => word.trim().split(" ").map(sym => MORSE_REV[sym] ?? "?").join("")).join(" "),
  },
  {
    name: "Unicode Escape",
    description: "JS-style \\uXXXX sequences",
    color: "#ef4444", category: "Other",
    encode: (i) => Array.from(i).map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4,"0")}`).join(""),
    decode: (i) => { try { return i.replace(/\\u([0-9a-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16))); } catch { return "[decode error]"; } },
  },
];

const CATEGORIES = ["Common", "Cipher", "Binary", "Transform", "Other"];

/* ─── Helpers ─────────────────────────────────────────────────── */

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultParams(enc: Encoding): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const p of enc.params ?? []) out[p.key] = p.default;
  return out;
}

function truncate(s: string, n = 36) { return s.length > n ? s.slice(0, n) + "…" : s; }

/* ─── Icons ───────────────────────────────────────────────────── */

function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function CopyIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
}
function DragHandle() {
  return <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" opacity="0.5">{[0,6,12].map(y=><g key={y}><circle cx="2.5" cy={y+2} r="1.3"/><circle cx="7.5" cy={y+2} r="1.3"/></g>)}</svg>;
}

/* ─── ChainBlockItem ─────────────────────────────────────────── */

interface ChainBlockItemProps {
  block: ChainBlock;
  index: number;
  stageInput: string;
  stageOutput: string;
  isDropTarget: boolean;
  dropPosition: "before" | "after" | null;
  onRemove: (id: string) => void;
  onParamChange: (id: string, key: string, value: number | string) => void;
  onModeToggle: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
}

function ChainBlockItem({ block, index, stageInput, stageOutput, isDropTarget, dropPosition, onRemove, onParamChange, onModeToggle, onDragStart, onDragOver }: ChainBlockItemProps) {
  const enc = encodings.find((e) => e.name === block.encodingName)!;
  const canDecode = !!enc.decode;
  const isDecode = block.mode === "decode";

  return (
    <div
      className={`chain-slot ${isDropTarget && dropPosition==="before"?"drop-before":""} ${isDropTarget && dropPosition==="after"?"drop-after":""}`}
      onDragOver={(e) => onDragOver(e, index)}
    >
      <div
        className="chain-block-item"
        style={{ "--c": enc.color } as React.CSSProperties}
        draggable
        onDragStart={(e) => onDragStart(e, index)}
      >
        <div className="chain-tab" />
        <div className="chain-block-body">
          <span className="chain-drag-handle"><DragHandle /></span>

          {/* Mode toggle */}
          <button
            className={`mode-toggle ${isDecode?"dec":"enc"} ${!canDecode?"no-decode":""}`}
            onClick={() => canDecode && onModeToggle(block.id)}
            title={canDecode ? (isDecode ? "Switch to Encode" : "Switch to Decode") : "Decode not available"}
            disabled={!canDecode}
          >
            <span className="mode-toggle-enc">ENC</span>
            <span className="mode-toggle-dec">DEC</span>
          </button>

          <span className="chain-block-name">{enc.name}</span>

          {enc.params?.map((p) => (
            <span key={p.key} className="chain-param">
              <span className="chain-param-label">{p.label}</span>
              {p.type === "select" ? (
                <select className="chain-param-select" value={block.params[p.key]} onChange={e => onParamChange(block.id, p.key, Number(e.target.value)||e.target.value)} onMouseDown={e=>e.stopPropagation()}>
                  {p.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className={p.type==="text"?"chain-param-text":"chain-param-number"} type={p.type} value={String(block.params[p.key]??p.default)} onChange={e=>onParamChange(block.id,p.key,p.type==="text"?e.target.value:Number(e.target.value))} onMouseDown={e=>e.stopPropagation()} min={(p as any).min} max={(p as any).max} maxLength={32} />
              )}
            </span>
          ))}

          <button className="chain-remove-btn" onClick={() => onRemove(block.id)} title="Remove"><TrashIcon /></button>
        </div>

        {stageInput && (
          <div className="chain-preview">
            <span className="chain-preview-in">{truncate(stageInput)}</span>
            <span className="chain-preview-arrow">{isDecode?"←":"→"}</span>
            <span className="chain-preview-out">{truncate(stageOutput)}</span>
          </div>
        )}
        <div className="chain-notch" />
      </div>
    </div>
  );
}

/* ─── PaletteBlock ───────────────────────────────────────────── */

function PaletteBlock({ enc, onDragStart }: { enc: Encoding; onDragStart: (e: React.DragEvent, name: string) => void }) {
  return (
    <button
      className="palette-block"
      style={{ "--c": enc.color } as React.CSSProperties}
      draggable
      onDragStart={(e) => onDragStart(e, enc.name)}
      title={enc.description}
    >
      <span className="palette-block-text">{enc.name}</span>
    </button>
  );
}

/* ─── Home ────────────────────────────────────────────────────── */

export default function Home() {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState<ChainBlock[]>([]);
  const [dragSource, setDragSource] = useState<{ type: "palette"; name: string } | { type: "chain"; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "before" | "after" } | null>(null);
  const [droppingOnZone, setDroppingOnZone] = useState(false);
  const [copied, setCopied] = useState(false);
  const chainZoneRef = useRef<HTMLDivElement>(null);

  const stages = useMemo(() => {
    const result: string[] = [input];
    for (const block of chain) {
      const enc = encodings.find((e) => e.name === block.encodingName);
      if (enc) {
        const prev = result[result.length - 1];
        const fn = block.mode === "decode" ? (enc.decode ?? enc.encode) : enc.encode;
        result.push(prev ? fn(prev, block.params) : "");
      }
    }
    return result;
  }, [input, chain]);

  const output = stages[stages.length - 1] ?? "";

  const handleParamChange = useCallback((id: string, key: string, value: number | string) => {
    setChain(prev => prev.map(b => b.id===id ? {...b, params:{...b.params,[key]:value}} : b));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setChain(prev => prev.filter(b => b.id!==id));
  }, []);

  const handleModeToggle = useCallback((id: string) => {
    setChain(prev => prev.map(b => b.id===id ? {...b, mode: b.mode==="encode"?"decode":"encode"} : b));
  }, []);

  const handlePaletteDragStart = useCallback((e: React.DragEvent, name: string) => {
    e.dataTransfer.setData("type", "palette");
    e.dataTransfer.setData("name", name);
    e.dataTransfer.effectAllowed = "copy";
    setDragSource({ type: "palette", name });
  }, []);

  const handleChainDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("type", "chain");
    e.dataTransfer.setData("index", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ type: "chain", index });
  }, []);

  const handleChainBlockDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget({ index, position });
    setDroppingOnZone(false);
  }, []);

  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDroppingOnZone(true);
    setDropTarget(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!chainZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
      setDroppingOnZone(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    let insertAt = chain.length;
    if (dropTarget !== null) {
      insertAt = dropTarget.position === "before" ? dropTarget.index : dropTarget.index + 1;
    }

    if (type === "palette") {
      const name = e.dataTransfer.getData("name");
      const enc = encodings.find(e => e.name === name);
      if (enc) {
        setChain(prev => {
          const next = [...prev];
          next.splice(insertAt, 0, { id: uid(), encodingName: name, params: defaultParams(enc), mode: "encode" });
          return next;
        });
      }
    } else if (type === "chain") {
      const fromIndex = Number(e.dataTransfer.getData("index"));
      setChain(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        const adj = insertAt > fromIndex ? insertAt - 1 : insertAt;
        next.splice(adj, 0, moved);
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

  const lastEnc = chain.length > 0 ? encodings.find(e => e.name === chain[chain.length-1].encodingName) : null;
  const outputDotColor = lastEnc?.color ?? "#6c8ef5";

  return (
    <main className="page" onDragEnd={handleDragEnd}>
      <header className="page-header">
        <div className="logo-row">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <div>
            <h1 className="site-title">Message Encoder</h1>
            <p className="site-subtitle">Drag encoding blocks into the pipeline — toggle ENC/DEC on each block to encode or decode</p>
          </div>
        </div>
      </header>

      <section className="pipeline-row">
        {/* Input */}
        <div className="io-panel input-panel">
          <div className="panel-label"><span className="panel-dot" style={{background:"#6c8ef5"}}/>Input</div>
          <textarea className="io-textarea" placeholder="Type or paste your message here..." value={input} onChange={e=>setInput(e.target.value)} spellCheck={false}/>
          <div className="panel-footer">
            <span className="char-count">{input.length} chars</span>
            {input && <button className="clear-btn" onClick={()=>setInput("")}>Clear</button>}
          </div>
        </div>

        <div className="flow-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>

        {/* Chain zone */}
        <div
          ref={chainZoneRef}
          className={`chain-zone ${droppingOnZone&&chain.length===0?"drop-active":""} ${chain.length===0?"empty":""}`}
          onDragOver={handleZoneDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="chain-zone-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
            Pipeline
            {chain.length > 0 && <span className="chain-count">{chain.length}</span>}
          </div>

          {chain.length === 0 ? (
            <div className="chain-empty-state">
              <div className="chain-empty-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <rect x="2" y="7" width="8" height="10" rx="2"/><rect x="9" y="7" width="8" height="10" rx="2"/>
                  <rect x="16" y="7" width="6" height="10" rx="2"/>
                </svg>
              </div>
              <p>Drag blocks here</p>
              <p className="chain-empty-sub">Chain multiple encodings or decodings</p>
            </div>
          ) : (
            <div className="chain-blocks">
              {chain.map((block, index) => (
                <ChainBlockItem
                  key={block.id}
                  block={block}
                  index={index}
                  stageInput={stages[index]}
                  stageOutput={stages[index+1]??""}
                  isDropTarget={dropTarget?.index===index}
                  dropPosition={dropTarget?.index===index?dropTarget.position:null}
                  onRemove={handleRemove}
                  onParamChange={handleParamChange}
                  onModeToggle={handleModeToggle}
                  onDragStart={handleChainDragStart}
                  onDragOver={handleChainBlockDragOver}
                />
              ))}
              <div
                className={`chain-end-drop ${droppingOnZone?"active":""}`}
                onDragOver={(e)=>{e.preventDefault();e.stopPropagation();setDroppingOnZone(true);setDropTarget(null);}}
              />
            </div>
          )}
        </div>

        <div className="flow-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>

        {/* Output */}
        <div className="io-panel output-panel">
          <div className="panel-label">
            <span className="panel-dot" style={{background:outputDotColor, transition:"background 0.2s"}}/>
            Output
            {chain.length===0&&<span className="panel-hint"> — add a block</span>}
          </div>
          <div className="io-output">
            {output
              ? <code className="output-code">{output}</code>
              : <span className="output-placeholder">{chain.length===0?"Add encoding blocks to the pipeline":"Type a message to see output"}</span>
            }
          </div>
          <div className="panel-footer">
            <span className="char-count">{output.length} chars</span>
            <button className={`copy-btn ${copied?"copied":""} ${!output?"disabled":""}`} onClick={handleCopy} disabled={!output}>
              {copied?<CheckIcon/>:<CopyIcon/>}
              {copied?"Copied!":"Copy"}
            </button>
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="palette-section">
        <div className="palette-header">
          <h2 className="palette-title">Encoding Blocks</h2>
          <p className="palette-hint">Drag into the pipeline — toggle ENC / DEC on each block</p>
        </div>
        {CATEGORIES.map(cat => {
          const group = encodings.filter(e => e.category === cat);
          return (
            <div key={cat} className="palette-group">
              <div className="palette-group-label">{cat}</div>
              <div className="palette-row">
                {group.map(enc => <PaletteBlock key={enc.name} enc={enc} onDragStart={handlePaletteDragStart}/>)}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
