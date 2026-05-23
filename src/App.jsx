import { useState, useRef, useEffect, useCallback } from "react";

// ── Palette & tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#000000",
  surface: "#0d0d0d",
  card: "#161616",
  border: "#2a2a2a",
  accent: "#00c2ff",
  accentDim: "#0077aa",
  gold: "#f0b429",
  green: "#10b981",
  red: "#ef4444",
  textPrimary: "#ffffff",
  textSecondary: "#aaaaaa",
  textMuted: "#555555",
};

const TOPICS = [
  { id: "endo-colon", label: "Colorectal Lesions" },
  { id: "endo-gastric", label: "Gastric Lesions" },
  { id: "gib", label: "GI Bleeding" },
  { id: "cirrhosis", label: "Cirrhosis" },
  { id: "liver", label: "Liver (ex-Cirrhosis)" },
  { id: "pancreatic", label: "Pancreas" },
  { id: "biliary", label: "Biliary" },
  { id: "ibd", label: "IBD" },
  { id: "acid-peptic", label: "Acid-Peptic" },
  { id: "motility", label: "Motility" },
  { id: "fgid", label: "FGID" },
  { id: "nutrition", label: "Nutrition" },
  { id: "infections", label: "Infections" },
];

const EXAM_SYSTEM = `You are a specialist gastroenterology exam tutor. Answer in structured exam format:
- Use headings, numbered lists, and tables
- Be precise and cite guideline names (BSG, NICE, EASL, ACG, ECCO etc.)
- Format drug doses clearly
- For algorithms, use numbered steps
- Keep answers focused and exam-ready`;

const CLINIC_SYSTEM = `You are a clinical gastroenterology decision-support tool used by specialist trainees on ward rounds and in clinic.
Rules:
- Answer ONLY from the guidelines provided in the knowledge base
- If a topic isn't covered, say: "This topic is not covered in the uploaded guidelines"
- Structure answers for rapid clinical use: lead with the key action, then detail
- Use markdown tables for comparisons, scoring systems, and drug doses
- Use numbered steps for management algorithms
- Bold key decision points
- Tag guideline source at the end of each answer e.g. [BSG 2023]
- Be concise — clinicians need fast answers`;

// ── Markdown-ish renderer ─────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let tableRows = [];
  let inTable = false;
  let key = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const body = tableRows.slice(2);
      elements.push(
        <div key={key++} style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: 13,
            border: `1px solid ${C.border}`
          }}>
            <thead>
              <tr>{headers.map((h, i) => (
                <th key={i} style={{
                  background: C.accentDim, color: C.textPrimary,
                  padding: "7px 12px", textAlign: "left",
                  fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", fontSize: 12,
                  border: `1px solid ${C.border}`
                }}>{h.trim()}</th>
              ))}</tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? C.card : C.surface }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: "6px 12px", color: C.textPrimary, fontSize: 13,
                      border: `1px solid ${C.border}`, verticalAlign: "top"
                    }}>{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      inTable = true;
      const cells = line.split("|").filter((_, ci) => ci > 0 && ci < line.split("|").length - 1);
      tableRows.push(cells);
      continue;
    }
    if (inTable) flushTable();

    // H1/H2/H3
    if (line.startsWith("### ")) {
      elements.push(<h3 key={key++} style={{ color: C.accent, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", fontSize: 13, margin: "14px 0 4px", letterSpacing: 1, textTransform: "uppercase" }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} style={{ color: C.gold, fontSize: 15, margin: "16px 0 6px", fontWeight: 700 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={key++} style={{ color: C.textPrimary, fontSize: 17, margin: "16px 0 8px", fontWeight: 700 }}>{line.slice(2)}</h1>);
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 10, margin: "4px 0", paddingLeft: 4 }}>
          <span style={{ color: C.accent, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", fontSize: 12, minWidth: 18 }}>{line.match(/^\d+/)[0]}.</span>
          <span style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: boldify(content) }} />
        </div>
      );
    }
    // Bullet
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 8, margin: "3px 0", paddingLeft: 8 }}>
          <span style={{ color: C.accent, marginTop: 2, flexShrink: 0 }}>▸</span>
          <span style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: boldify(line.slice(2)) }} />
        </div>
      );
    }
    // Citation tag [BSG 2023]
    else if (line.trim().match(/^\[.+\]$/)) {
      elements.push(
        <div key={key++} style={{
          display: "inline-block", background: `${C.accentDim}33`,
          border: `1px solid ${C.accentDim}`, borderRadius: 4,
          padding: "2px 8px", fontSize: 11, color: C.accent,
          fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", marginTop: 8
        }}>{line.trim()}</div>
      );
    }
    // Horizontal rule
    else if (line.trim() === "---") {
      elements.push(<hr key={key++} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "12px 0" }} />);
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: 6 }} />);
    }
    // Normal text
    else {
      elements.push(
        <p key={key++} style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.7, margin: "3px 0" }}
          dangerouslySetInnerHTML={{ __html: boldify(line) }} />
      );
    }
  }
  if (inTable) flushTable();
  return elements;
}

function boldify(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.gold};font-weight:700">$1</strong>`)
    .replace(/`(.+?)`/g, `<code style="background:#1e1e1e;color:${C.accent};padding:1px 5px;border-radius:3px;font-family:'Calibri','Carlito',Arial,sans-serif;font-size:12px">$1</code>`);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function GastroRef() {
  const [tab, setTab] = useState("chat"); // chat | browse | guidelines
  const [mode, setMode] = useState("clinic"); // clinic | exam
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [guidelines, setGuidelines] = useState([]);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseResult, setBrowseResult] = useState(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem("gastroref_gemini_key") || ""; } catch { return ""; } });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";

  const geminiCall = async (systemInstruction, contents, maxTokens = 1500) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens }
        })
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const guidelinesContext = guidelines.length > 0
    ? "\n\nKNOWLEDGE BASE (uploaded guidelines):\n" + guidelines.map(g => `=== ${g.name} ===\n${g.content}`).join("\n\n")
    : "\n\nNo guidelines have been uploaded yet. Tell the user to upload guidelines in the Guidelines tab.";

  const systemPrompt = (mode === "exam" ? EXAM_SYSTEM : CLINIC_SYSTEM) + guidelinesContext;

  // PDF upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.type !== "application/pdf") { notify("Only PDF files supported", "error"); continue; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(",")[1];
        notify(`Processing ${file.name}...`, "info");
        try {
          const extractedContent = await geminiCall(
            "You are a medical document extractor. Extract ALL clinical guideline content from the provided PDF. Preserve all recommendations, drug doses, scoring systems, tables, and algorithms verbatim. Format clearly with headings.",
            [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: base64 } }, { text: "Extract all clinical guideline content from this PDF." }] }],
            4000
          );
          const content = extractedContent;
          setGuidelines(prev => [...prev.filter(g => g.name !== file.name), { name: file.name, content, addedAt: new Date().toLocaleString() }]);
          notify(`✓ ${file.name} loaded`);
        } catch { notify(`Failed to process ${file.name}`, "error"); }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  // Chat send
  const sendMessage = async (overrideInput) => {
    const text = overrideInput || input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text, id: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    try {
      const geminiHistory = history.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const reply = await geminiCall(systemPrompt, geminiHistory);
      setMessages(prev => [...prev, { role: "assistant", content: reply, id: Date.now() + 1 }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error contacting AI. Please try again.", id: Date.now() + 1 }]); }
    setLoading(false);
  };

  // Browse topic
  const browseTopic = async (query) => {
    if (!query.trim()) return;
    setBrowseLoading(true);
    setBrowseResult(null);
    try {
      const browseContent = await geminiCall(
        systemPrompt,
        [{ role: "user", parts: [{ text: `Provide a comprehensive quick-reference summary for: ${query}. Include: key diagnostic criteria, scoring systems (as tables), management algorithm (numbered steps), drug doses, and when to escalate. Format for rapid clinical use.` }] }]
      );
      setBrowseResult({ query, content: browseContent });
    } catch { setBrowseResult({ query, content: "Error fetching reference." }); }
    setBrowseLoading(false);
  };

  // Edit/correct message
  const saveEdit = (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editText, edited: true } : m));
    setEditingMsg(null);
  };

  const saveApiKey = () => {
    const k = apiKeyInput.trim();
    if (!k) return;
    try { localStorage.setItem("gastroref_gemini_key", k); } catch {}
    setApiKey(k);
    setApiKeyInput("");
  };

  if (!apiKey) return (
    <div style={{
      fontFamily: "'Calibri', 'Carlito', Arial, sans-serif",
      background: C.bg, minHeight: "100vh", color: C.textPrimary,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{ width: 420, padding: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="20" rx="2" fill="#10b981"/>
            <rect x="2" y="9" width="20" height="6" rx="2" fill="#10b981"/>
          </svg>
          <span style={{ fontSize: 22, fontWeight: 700 }}>GastroRef</span>
        </div>
        <div style={{ fontSize: 15, color: C.textSecondary, marginBottom: 6 }}>Enter your Gemini API key to get started</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Get a free key at <span style={{ color: C.accent }}>aistudio.google.com</span> → Get API key. Your key is saved locally on this device only.
        </div>
        <input
          type="password"
          value={apiKeyInput}
          onChange={e => setApiKeyInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && saveApiKey()}
          placeholder="AIza..."
          style={{
            width: "100%", padding: "11px 14px", background: C.card,
            border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.textPrimary, fontSize: 14, marginBottom: 12
          }}
        />
        <button onClick={saveApiKey} style={{
          width: "100%", padding: "11px", background: C.green, border: "none",
          borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 700,
          cursor: "pointer"
        }}>Continue</button>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 16, lineHeight: 1.6 }}>
          Free tier: 1,000 requests/day · No credit card required · Gemini 2.5 Flash
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      fontFamily: "'Calibri', 'Carlito', Arial, sans-serif",
      background: C.bg, minHeight: "100vh", color: C.textPrimary,
      display: "flex", flexDirection: "column"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        textarea, input { outline: none; font-family: 'Calibri', 'Carlito', Arial, sans-serif; }
        button { cursor: pointer; font-family: 'Calibri', 'Carlito', Arial, sans-serif; }
        .msg-enter { animation: slideUp .25s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .topic-btn:hover { background: ${C.accentDim} !important; transform: translateY(-2px); box-shadow: 0 4px 16px #00c2ff22; }
        .send-btn:hover { background: ${C.accentDim} !important; }
        .tab-btn:hover { color: ${C.textPrimary} !important; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>

      {/* Header */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: C.bg, border: `1px solid ${C.green}33`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="20" rx="2" fill="#10b981"/>
            <rect x="2" y="9" width="20" height="6" rx="2" fill="#10b981"/>
          </svg></div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5, color: C.textPrimary }}>GastroRef</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginRight: 4, textTransform: "uppercase", letterSpacing: 1 }}>Mode</div>
          {["clinic", "exam"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "5px 14px", borderRadius: 20, border: "none", fontSize: 12,
              letterSpacing: 0.5, textTransform: "uppercase",
              background: mode === m ? (m === "exam" ? C.gold : C.accent) : C.card,
              color: mode === m ? C.bg : C.textSecondary,
              fontWeight: mode === m ? 700 : 400, transition: "all .2s"
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0, paddingLeft: 24 }}>
        {[
          { id: "chat", label: "💬 Chat", desc: "Ask anything" },
          { id: "browse", label: "📚 Quick Reference", desc: "Topic cards" },
          { id: "guidelines", label: "📂 Guidelines", desc: `${guidelines.length} loaded` }
        ].map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
            padding: "12px 22px", border: "none", background: "transparent",
            color: tab === t.id ? C.accent : C.textMuted,
            borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            transition: "all .2s", letterSpacing: 0.3
          }}>{t.label}</button>
        ))}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: notification.type === "error" ? C.red : notification.type === "info" ? C.accentDim : C.green,
          color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13,
          boxShadow: "0 4px 20px rgba(0,0,0,.4)", animation: "slideUp .3s ease"
        }}>{notification.msg}</div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {messages.length === 0 && (
            <div style={{ padding: "32px 24px 16px", flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Topics</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TOPICS.map(t => (
                  <button key={t.id} className="topic-btn" onClick={() => sendMessage(`Give me a quick reference summary for ${t.label}`)} style={{
                    padding: "8px 16px", borderRadius: 8,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.textSecondary, fontSize: 13, transition: "all .2s", display: "flex", gap: 6, alignItems: "center"
                  }}>{t.label}</button>
                ))}
              </div>
              {guidelines.length === 0 && (
                <div style={{
                  marginTop: 20, padding: "14px 18px", borderRadius: 8,
                  background: `${C.gold}11`, border: `1px solid ${C.gold}44`,
                  fontSize: 13, color: C.gold, display: "flex", gap: 10, alignItems: "center"
                }}>
                  ⚠ No guidelines uploaded. Go to the <strong>Guidelines tab</strong> to upload your PDFs for guideline-specific answers.
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg) => (
              <div key={msg.id} className="msg-enter" style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", letterSpacing: 1, paddingLeft: msg.role === "assistant" ? 2 : 0 }}>
                  {msg.role === "user" ? "YOU" : `GASTROREF ${mode.toUpperCase()}`}
                  {msg.edited && <span style={{ color: C.gold, marginLeft: 8 }}>edited</span>}
                </div>
                <div style={{
                  maxWidth: "88%", padding: "12px 16px", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  background: msg.role === "user" ? `linear-gradient(135deg, ${C.accentDim}, #005580)` : C.card,
                  border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
                  boxShadow: "0 2px 12px rgba(0,0,0,.25)"
                }}>
                  {editingMsg === msg.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        style={{ width: "100%", minHeight: 100, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 6, color: C.textPrimary, padding: 10, fontSize: 13, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => saveEdit(msg.id)} style={{ padding: "5px 14px", background: C.green, border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }}>Save</button>
                        <button onClick={() => setEditingMsg(null)} style={{ padding: "5px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSecondary, fontSize: 12 }}>Cancel</button>
                      </div>
                    </div>
                  ) : msg.role === "user" ? (
                    <div style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.6 }}>{msg.content}</div>
                  ) : (
                    <div>{renderMarkdown(msg.content)}</div>
                  )}
                </div>
                {msg.role === "assistant" && editingMsg !== msg.id && (
                  <button onClick={() => { setEditingMsg(msg.id); setEditText(msg.content); }} style={{
                    background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: "3px 10px", fontSize: 11, color: C.textMuted, display: "flex", gap: 5, alignItems: "center",
                    fontFamily: "'Calibri', 'Carlito', Arial, sans-serif"
                  }}>✏ Correct this response</button>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}
                </div>
                <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif" }}>Consulting guidelines…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.surface }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={guidelines.length > 0 ? "Ask a clinical question… (Enter to send, Shift+Enter for new line)" : "Upload guidelines first, then ask questions…"}
                rows={2}
                style={{
                  flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                  color: C.textPrimary, padding: "12px 16px", fontSize: 14,
                  resize: "none", lineHeight: 1.5,
                  transition: "border-color .2s",
                  borderColor: input ? C.accentDim : C.border
                }} />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                width: 48, height: 48, borderRadius: 10, border: "none",
                background: loading || !input.trim() ? C.card : C.accent,
                color: loading || !input.trim() ? C.textMuted : C.bg,
                fontSize: 18, transition: "all .2s", flexShrink: 0
              }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BROWSE TAB ── */}
      {tab === "browse" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Topic Quick Reference</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 28 }}>
            {TOPICS.map(t => (
              <button key={t.id} className="topic-btn" onClick={() => { setBrowseQuery(t.label); browseTopic(t.label); }} style={{
                padding: "14px 12px", borderRadius: 12, background: C.card,
                border: `1px solid ${browseQuery === t.label ? C.accent : C.border}`,
                color: browseQuery === t.label ? C.accent : C.textSecondary,
                fontSize: 13, transition: "all .2s", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center"
              }}>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input value={browseQuery} onChange={e => setBrowseQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && browseTopic(browseQuery)}
              placeholder="Search any GI topic…"
              style={{
                flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                color: C.textPrimary, padding: "11px 16px", fontSize: 14
              }} />
            <button onClick={() => browseTopic(browseQuery)} disabled={browseLoading} style={{
              padding: "11px 22px", borderRadius: 10, border: "none",
              background: C.accent, color: C.bg, fontSize: 13, fontWeight: 600
            }}>{browseLoading ? "…" : "Look up"}</button>
          </div>

          {browseLoading && (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif", fontSize: 12 }}>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ${i*.2}s infinite` }} />)}
              </div>
              LOADING REFERENCE…
            </div>
          )}

          {browseResult && !browseLoading && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{browseResult.query}</div>
                <button onClick={() => { setTab("chat"); sendMessage(`Give me more detail on ${browseResult.query}`); }} style={{
                  padding: "6px 14px", background: "transparent", border: `1px solid ${C.accent}`,
                  borderRadius: 6, color: C.accent, fontSize: 12, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif"
                }}>Ask follow-up →</button>
              </div>
              {renderMarkdown(browseResult.content)}
            </div>
          )}
        </div>
      )}

      {/* ── GUIDELINES TAB ── */}
      {tab === "guidelines" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Knowledge Base</div>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${C.border}`, borderRadius: 14,
              padding: "40px 24px", textAlign: "center",
              background: C.card, cursor: "pointer", marginBottom: 24,
              transition: "all .2s"
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const dt = e.dataTransfer; if (dt.files) handleFileUpload({ target: { files: dt.files }, currentTarget: { value: "" } }); }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 15, color: C.textSecondary, marginBottom: 6 }}>Drop PDF guidelines here or click to upload</div>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif" }}>BSG · NICE · EASL · ECCO · ACG · ASGE · any PDF guideline</div>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileUpload} style={{ display: "none" }} />
          </div>

          {guidelines.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted, fontSize: 14 }}>
              No guidelines loaded yet. Upload PDFs above to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {guidelines.map((g, i) => (
                <div key={i} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600, marginBottom: 3 }}>📄 {g.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Calibri', 'Carlito', Arial, sans-serif" }}>
                      Loaded {g.addedAt} · {Math.round(g.content.length / 4)} tokens
                    </div>
                  </div>
                  <button onClick={() => { setGuidelines(prev => prev.filter((_, j) => j !== i)); notify("Guideline removed"); }} style={{
                    background: "transparent", border: `1px solid ${C.red}44`,
                    borderRadius: 6, padding: "5px 12px", color: C.red, fontSize: 12,
                    fontFamily: "'Calibri', 'Carlito', Arial, sans-serif"
                  }}>Remove</button>
                </div>
              ))}
            </div>
          )}

          {guidelines.length > 0 && (
            <div style={{ marginTop: 24, padding: "14px 18px", background: `${C.green}11`, border: `1px solid ${C.green}44`, borderRadius: 10, fontSize: 13, color: C.green }}>
              ✓ {guidelines.length} guideline{guidelines.length !== 1 ? "s" : ""} active — switch to Chat or Quick Reference to query them.
            </div>
          )}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>Powered by Gemini 2.5 Flash · Free tier</div>
            <button onClick={() => { try { localStorage.removeItem("gastroref_gemini_key"); } catch {} setApiKey(""); }} style={{
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "5px 14px", color: C.textMuted, fontSize: 12, cursor: "pointer"
            }}>Change API key</button>
          </div>
        </div>
      )}
    </div>
  );
}
