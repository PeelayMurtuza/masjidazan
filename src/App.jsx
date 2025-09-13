import React, { useState, useRef, useEffect } from "react";
import Peer from "peerjs";

export default function App() {
  const [mode, setMode] = useState(null); // "broadcast" or "listen"
  const [status, setStatus] = useState("Idle...");
  const [authKey, setAuthKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [listenerKey, setListenerKey] = useState("");
  const [listenerAuthorized, setListenerAuthorized] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const audioRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  const FIXED_BROADCAST_ID = "azan-broadcast-001";
  const MUAZZIN_KEY = "1234"; // Muazzin key
  const LISTENER_KEY = "5678"; // Listener key

  const bc = useRef(new BroadcastChannel("azan-notify"));

  // Initialize listener state from localStorage
  useEffect(() => {
    const savedListener = localStorage.getItem("listenerAuthorized");
    const savedKey = localStorage.getItem("listenerKey");
    if (savedListener && savedKey) {
      setListenerAuthorized(true);
      setListenerKey(savedKey);
      setStatus("✅ Previously verified! Waiting for Azan...");
    }

    // Service worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.log("SW failed:", err));
    }

    // Listen for Azan broadcast
    bc.current.onmessage = (event) => {
      if (event.data === "AZAN_START" && listenerAuthorized) {
        setStatus("🔔 Azan starting! Connecting...");
        startListeningAuto();
      }
      if (event.data === "AZAN_STOP") {
        setStatus("📴 Azan broadcast stopped");
        if (audioRef.current) audioRef.current.pause();
        setMode(null);
      }
    };
  }, [listenerAuthorized]);

  // Verify Muazzin
  const verifyMuazzinKey = () => {
    if (authKey === MUAZZIN_KEY) {
      setAuthorized(true);
      setStatus("✅ Authorized. You can start broadcasting now.");
    } else {
      alert("❌ Wrong Muazzin key!");
      setAuthKey("");
    }
  };

  // Verify Listener
  const verifyListenerKey = () => {
    if (listenerKey === LISTENER_KEY) {
      setListenerAuthorized(true);
      setStatus("✅ Key verified! You will auto-connect when Azan starts.");
      localStorage.setItem("listenerAuthorized", "true");
      localStorage.setItem("listenerKey", listenerKey);
    } else {
      alert("❌ Wrong Listener key!");
      setListenerKey("");
    }
  };

  // Start broadcasting
  const startBroadcast = async () => {
    if (!authorized) return alert("Enter Muazzin key first!");
    setMode("broadcast");
    setBroadcasting(true);
    setStatus("📡 Broadcasting...");

    // Notify listeners
    bc.current.postMessage("AZAN_START");

    peerRef.current = new Peer(FIXED_BROADCAST_ID, {
      host: "peerjs-server.herokuapp.com",
      secure: true,
      port: 443,
    });

    peerRef.current.on("open", () =>
      console.log("Broadcasting with ID:", FIXED_BROADCAST_ID)
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      peerRef.current.on("call", (call) => {
        call.answer(stream);
        setStatus("✅ Listener connected!");
      });
    } catch (err) {
      console.error(err);
      setStatus("❌ Error accessing microphone.");
    }
  };

  // Stop broadcasting
  const stopBroadcast = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      setBroadcasting(false);
      setMode(null);
      setStatus("📴 Broadcast stopped");
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    bc.current.postMessage("AZAN_STOP");
  };

  // Listener auto-connect
  const startListeningAuto = () => {
    setMode("listen");
    peerRef.current = new Peer();

    peerRef.current.on("open", () => {
      const call = peerRef.current.call(FIXED_BROADCAST_ID, new MediaStream());
      call.on("stream", (remoteStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.play().catch(() => {
            setStatus("🔔 Tap play if audio blocked by browser.");
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
          {/* Muazzin auth */}
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
                onClick={verifyMuazzinKey}
                className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600"
              >
                Verify Muazzin Key
              </button>
            </div>
          )}

          {/* Broadcast / Stop */}
          {authorized && !broadcasting && (
            <button
              onClick={startBroadcast}
              className="w-full bg-green-500 px-6 py-3 rounded-lg shadow-lg hover:bg-green-600"
            >
              Start Broadcast (Masjid)
            </button>
          )}
          {broadcasting && (
            <button
              onClick={stopBroadcast}
              className="w-full bg-red-500 px-6 py-3 rounded-lg shadow-lg hover:bg-red-600"
            >
              Stop Broadcast
            </button>
          )}

          {/* Listener auth */}
          {!listenerAuthorized && (
            <div className="flex flex-col space-y-2">
              <input
                type="password"
                placeholder="Enter Listener Key"
                value={listenerKey}
                onChange={(e) => setListenerKey(e.target.value)}
                className="px-4 py-2 rounded border-white text-white text-center"
              />
              <button
                onClick={verifyListenerKey}
                className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
              >
                Verify Listener Key
              </button>
            </div>
          )}

          {/* Manual Listener Start */}
          {listenerAuthorized && !mode && (
            <button
              onClick={startListeningAuto}
              className="w-full bg-blue-500 px-6 py-3 rounded-lg shadow-lg hover:bg-blue-600"
            >
              Start Listening (Home)
            </button>
          )}
        </div>
      )}

      {/* Broadcast Mode */}
      {mode === "broadcast" && (
        <div className="mt-6">
          <p className="mb-2">
            📡 Broadcasting with ID: {FIXED_BROADCAST_ID}
          </p>
        </div>
      )}

      {/* Listen Mode */}
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

      <p className="mt-6 text-sm text-gray-300">{status}</p>
    </div>
  );
}
