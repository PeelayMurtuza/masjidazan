import React, { useState, useRef, useEffect } from "react";
import Peer from "peerjs";

export default function App() {
  const [mode, setMode] = useState(null); // "broadcast" or "listen"
  const [status, setStatus] = useState("Idle...");
  const [muazzinKey, setMuazzinKey] = useState(""); // Muazzin auth input
  const [authorizedMuazzin, setAuthorizedMuazzin] = useState(false);
  const [broadcastKey, setBroadcastKey] = useState(""); // one-time key
  const [listenerKey, setListenerKey] = useState(""); // listener input
  const [authorizedListener, setAuthorizedListener] = useState(false);

  const audioRef = useRef(null);
  const peerRef = useRef(null);
  const bc = useRef(new BroadcastChannel("azan-notify"));

  const MUAZZIN_SECRET = "1234"; // Muazzin secret password

  // Check localStorage for listener
  useEffect(() => {
    const saved = localStorage.getItem("authorizedListener");
    const savedKey = localStorage.getItem("broadcastKey");
    if (saved && savedKey) {
      setListenerKey(savedKey);
      setAuthorizedListener(true);
      setStatus("✅ Previously verified! Waiting for broadcast...");
    }

    bc.current.onmessage = (event) => {
      if (event.data.type === "AZAN_START" && authorizedListener) {
        const key = event.data.key;
        if (listenerKey === key || localStorage.getItem("broadcastKey") === key) {
          setStatus("🔔 Azan starting! Connecting...");
          startListeningAuto(key);
        } else {
          setStatus("❌ Broadcast key mismatch!");
        }
      }
    };

    // Service worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.log("SW failed:", err));
    }
  }, [authorizedListener, listenerKey]);

  // Verify Muazzin
  const verifyMuazzin = () => {
    if (muazzinKey === MUAZZIN_SECRET) {
      setAuthorizedMuazzin(true);
      setStatus("✅ Authorized. You can start broadcasting now.");
    } else {
      alert("❌ Wrong Muazzin key!");
      setMuazzinKey("");
    }
  };

  // Start Broadcast
  const startBroadcast = async () => {
    if (!authorizedMuazzin) return alert("Enter Muazzin key first!");

    setMode("broadcast");

    const oneTimeKey = Math.floor(100000 + Math.random() * 900000).toString();
    setBroadcastKey(oneTimeKey);
    setStatus(`Broadcasting started! Share this key with listeners: ${oneTimeKey}`);

    bc.current.postMessage({ type: "AZAN_START", key: oneTimeKey });

    peerRef.current = new Peer(oneTimeKey);

    peerRef.current.on("open", () => console.log("Broadcasting with ID/key:", oneTimeKey));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      peerRef.current.on("call", (call) => {
        call.answer(stream);
        setStatus("Listener connected!");
      });
    } catch (err) {
      console.error(err);
      setStatus("❌ Error accessing microphone.");
    }
  };

  // Verify Listener Key
  const verifyListenerKey = () => {
    if (!listenerKey) return alert("Enter the broadcast key!");
    setAuthorizedListener(true);
    localStorage.setItem("authorizedListener", "true");
    localStorage.setItem("broadcastKey", listenerKey);
    setStatus("✅ Key verified! Waiting for broadcast...");
  };

  // Auto-connect
  const startListeningAuto = (key) => {
    setMode("listen");
    peerRef.current = new Peer();

    peerRef.current.on("open", () => {
      const call = peerRef.current.call(key, null);
      call.on("stream", (remoteStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => {
            setStatus("🔔 Azan started! Tap play if audio blocked.");
          });
        }
        setStatus("✅ Connected, playing Azan...");
      });
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-6 text-center">
      <h1 className="text-3xl font-bold mb-6">📢 Azan Live Stream PWA</h1>

      {!mode && (
        <div className="space-y-6 w-full max-w-xs">

          {!authorizedMuazzin && (
            <div className="flex flex-col space-y-2">
              <input
                type="password"
                placeholder="Enter Muazzin Key"
                value={muazzinKey}
                onChange={(e) => setMuazzinKey(e.target.value)}
                className="px-4 py-2 rounded text-black text-center"
              />
              <button
                onClick={verifyMuazzin}
                className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600"
              >
                Verify Muazzin Key
              </button>
            </div>
          )}

          {authorizedMuazzin && (
            <button
              onClick={startBroadcast}
              className="w-full bg-green-500 px-6 py-3 rounded-lg shadow-lg hover:bg-green-600"
            >
              Start Broadcast
            </button>
          )}

          {!authorizedListener && (
            <div className="flex flex-col space-y-2">
              <input
                type="text"
                placeholder="Enter Broadcast Key"
                value={listenerKey}
                onChange={(e) => setListenerKey(e.target.value)}
                className="px-4 py-2 rounded text-black text-center"
              />
              <button
                onClick={verifyListenerKey}
                className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
              >
                Verify Key
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "broadcast" && (
        <div className="mt-6">
          <p className="mb-2">
            📡 Broadcasting! Share this key with listeners: {broadcastKey}
          </p>
        </div>
      )}

      {mode === "listen" && (
        <div className="mt-6 flex flex-col items-center space-y-4">
          <audio ref={audioRef} autoPlay controls className="mt-4 w-64 rounded" />
        </div>
      )}

      <p className="mt-6 text-sm text-gray-300">{status}</p>
    </div>
  );
}
