import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { BACKEND_URL } from "./config";

function useRecipientCodeFromUrl() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code");
  }, []);
}

function App() {
  const recipientCodeFromUrl = useRecipientCodeFromUrl();

  // If URL has ?code=... we are on "Send compliment" mode
  const isSenderView = !!recipientCodeFromUrl;

  return (
    <div className="app">
      <div className="card">
        <header className="header">
          <h1>Anon Compliments 💌</h1>
          <p className="subtitle">
            Send and receive anonymous compliments in real-time.
          </p>
        </header>

        {isSenderView ? (
          <SendComplimentView recipientCode={recipientCodeFromUrl} />
        ) : (
          <CreateAndViewComplimentsView />
        )}

        <footer className="footer">
          <p>Made with React, Supabase & Socket.io ⚡</p>
        </footer>
      </div>
    </div>
  );
}

/* ---------------------- VIEW 1: OWNER VIEW ---------------------- */
function CreateAndViewComplimentsView() {
  const [recipientCode, setRecipientCode] = useState("");
  const [previewLink, setPreviewLink] = useState("");
  const [compliments, setCompliments] = useState([]);
  const [socket, setSocket] = useState(null);

  // Connect to socket when we have a recipientCode
  useEffect(() => {
    if (!recipientCode) return;

    const s = io(BACKEND_URL, {
      transports: ["websocket"],
    });

    s.on("connect", () => {
      s.emit("join-room", recipientCode);
    });

    s.on("new-compliment", (compliment) => {
      setCompliments((prev) => [compliment, ...prev]);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [recipientCode]);

  const handleGenerateCode = () => {
    // simple random code, backend doesn’t need to generate it
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRecipientCode(random);
    const link = `${window.location.origin}?code=${random}`;
    setPreviewLink(link);
    setCompliments([]); // reset list
  };

  const handleLoadCompliments = async () => {
    if (!recipientCode) {
      alert("Generate or enter a recipient code first.");
      return;
    }
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/compliments/${recipientCode}`
      );
      setCompliments(res.data.compliments || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load compliments. Check backend console.");
    }
  };

  return (
    <div className="view">
      <h2>Your Secret Code 🔐</h2>
      <p className="text-muted">
        Generate a code, share the link with her, and watch compliments appear
        in real-time.
      </p>

      <div className="code-area">
        <button className="btn primary" onClick={handleGenerateCode}>
          Generate New Code
        </button>

        <div className="code-input-row">
          <input
            type="text"
            placeholder="Or type your own code..."
            value={recipientCode}
            onChange={(e) => setRecipientCode(e.target.value.toUpperCase())}
          />
          <button className="btn" onClick={handleLoadCompliments}>
            Load Compliments
          </button>
        </div>

        {recipientCode && (
          <div className="share-box">
            <p className="label">Your code</p>
            <p className="code">{recipientCode}</p>

            <p className="label">Share this link 👇</p>
            <div className="link-row">
              <input
                type="text"
                readOnly
                value={previewLink || `${window.location.origin}?code=${recipientCode}`}
              />
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard
                    .writeText(
                      previewLink || `${window.location.origin}?code=${recipientCode}`
                    )
                    .then(() => alert("Link copied!"))
                    .catch(() => alert("Could not copy link"));
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <ComplimentList compliments={compliments} />
    </div>
  );
}

/* ---------------------- VIEW 2: SENDER VIEW ---------------------- */
function SendComplimentView({ recipientCode }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setSent(false);
    try {
      await axios.post(`${BACKEND_URL}/api/compliments`, {
        recipientCode,
        message,
      });
      setMessage("");
      setSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send compliment. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="view">
      <h2>Send an Anonymous Compliment 💖</h2>
      <p className="text-muted">
        Your message will be delivered secretly to <strong>{recipientCode}</strong>.
        No name, no identity, just kindness.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <textarea
          rows={4}
          placeholder="Write something sweet, supportive, or kind..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        ></textarea>

        <button className="btn primary full" type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send Compliment"}
        </button>

        {sent && <p className="success">Compliment sent 🎉</p>}
      </form>
    </div>
  );
}

/* ---------------------- COMPLIMENT LIST ---------------------- */
function ComplimentList({ compliments }) {
  if (!compliments || compliments.length === 0) {
    return (
      <div className="compliments empty">
        <p className="text-muted">
          No compliments yet. Share your link and watch them appear here in
          real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="compliments">
      <h3>Received Compliments ✨</h3>
      <ul>
        {compliments.map((c) => (
          <li key={c.id} className="compliment-item">
            <p>{c.message}</p>
            <span className="time">
              {c.created_at
                ? new Date(c.created_at).toLocaleString()
                : "Just now"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
