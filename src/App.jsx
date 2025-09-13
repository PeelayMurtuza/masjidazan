import React, { useState, useRef, useEffect } from "react";
import Peer from "peerjs";

export default function App() {
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState("Idle...");
  const [authKey, setAuthKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const audioRef = useRef(null);
  const peerRef = useRef(null);

  const FIXED_BROADCAST_ID = "azan-broadcast-001";
  const MUAZZIN_KEY = "1234";

  // BroadcastChannel for notifications
  const bc = useRef(new BroadcastChannel("azan-notify"));

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.log("SW failed:", err));
    }

    // Listen to notification channel
    bc.current.onmessage = (event) => {
      if (event.data === "AZAN_START") {
        setStatus("🔔 Azan is starting! Connecting...");
        startListeningAuto(); // auto connect listener
      }
    };
  }, []);

  // Verify Muazzin key
  const verifyKey = () => {
    if (authKey === MUAZZIN_KEY) {
      setAuthorized(true);
      setStatus("✅ Authorized. You can start broadcasting now.");
    } else {
      alert("❌ Wrong key! Access denied.");
      setAuthKey("");
    }
  };

  // Start Broadcast (Muazzin)
  const startBroadcast = async () => {
    if (!authorized) {
      alert("Enter the correct Muazzin key first!");
      return;
    }

    setMode("broadcast");
    setStatus("Starting broadcast...");

    // Send notification to all listeners
    bc.current.postMessage("AZAN_START");

    peerRef.current = new Peer(FIXED_BROADCAST_ID);

    peerRef.current.on("open", () => {
      setStatus("Broadcasting, waiting for listeners...");
    });

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

  // Start Listening (manual)
  const startListening = () => {
    setMode("listen");
    setStatus("Connecting to broadcaster...");
    connectListener();
  };

  // Auto-connect when Azan starts
  const startListeningAuto = () => {
    setMode("listen");
    connectListener();
  };

  const connectListener = () => {
    peerRef.current = new Peer();

    peerRef.current.on("open", () => {
      const call = peerRef.current.call(FIXED_BROADCAST_ID, null);
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
          {!authorized && (
            <div className="flex flex-col space-y-2">
              <input
                type="password"
                placeholder="Enter Muazzin Key"
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                className="px-4 py-2 rounded border-white text-white text-center"
              />
              <button
                onClick={verifyKey}
                className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600"
              >
                Verify Key
              </button>
            </div>
          )}

          {authorized && (
            <button
              onClick={startBroadcast}
              className="w-full bg-green-500 px-6 py-3 rounded-lg shadow-lg hover:bg-green-600"
            >
              Start Broadcast (Masjid)
            </button>
          )}

          <button
            onClick={startListening}
            className="w-full bg-blue-500 px-6 py-3 rounded-lg shadow-lg hover:bg-blue-600"
          >
            Start Listening (Home)
          </button>
        </div>
      )}

      {mode === "listen" && (
        <div className="mt-6 flex flex-col items-center space-y-4">
          <audio
            ref={audioRef}
            autoPlay
            controls
            className="mt-4 w-64 rounded"
          />
        </div>
      )}

      {mode === "broadcast" && (
        <div className="mt-6">
          <p className="mb-2">
            📡 Broadcasting to all homes with ID: {FIXED_BROADCAST_ID}
          </p>
        </div>
      )}

      <p className="mt-6 text-sm text-gray-300">{status}</p>
    </div>
  );
}
