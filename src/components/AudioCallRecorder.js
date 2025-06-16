// File: client/src/components/AudioCallRecorder.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./AudioCallRecorder.css";

const socket = io("https://f227-2409-40d2-114e-ed08-b090-7954-96d0-6a9.ngrok-free.app"); // or your ngrok URL

const AudioCallRecorder = () => {
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const mediaStream = useRef();
  const recorderRef = useRef();
  const [recording, setRecording] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.on("signal", ({ from, signal }) => {
      if (connectionRef.current) {
        connectionRef.current.signal(signal);
      }
    });

    return () => {
      socket.off("signal");
      socket.off("user-joined");
      socket.off("initiate-call");
    };
  }, []);

  const handleJoinRoom = () => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
    setJoined(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      mediaStream.current = stream;

      if (myVideo.current) {
        myVideo.current.srcObject = stream;
        myVideo.current.muted = true;
        myVideo.current.setAttribute("playsinline", true);
        myVideo.current.play().catch(() => {});
      }

      socket.on("user-joined", ({ from }) => {
        console.log("👋 A user was already in the room. You are the initiator.");
        setupPeer(true, from, mediaStream.current);
      });

      socket.on("initiate-call", ({ from }) => {
        console.log("📞 Another user is joining. You are the receiver.");
        setupPeer(false, from, mediaStream.current);
      });
    }).catch((err) => {
      alert("Error accessing webcam/mic: " + err.message);
      console.error(err);
    });
  };

  const setupPeer = (initiator, targetId, stream) => {
    console.log(`🔗 Setting up peer connection. Initiator: ${initiator}, Target: ${targetId}`);
    const peer = new Peer({ initiator, trickle: false, stream });

    peer.on("signal", (data) => {
      console.log("📤 Sending signal", data);
      socket.emit("signal", { to: targetId, from: socket.id, signal: data });
    });

    peer.on("stream", (remoteStream) => {
      console.log("📺 Received remote stream", remoteStream);
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
        userVideo.current.setAttribute("playsinline", true);
        userVideo.current.play().catch((e) => console.warn("Remote video play failed:", e));
      }
    });

    peer.on("connect", () => console.log("🟢 Peer connected"));


    connectionRef.current = peer;
  };

  const startRecording = () => {
    const audioOnlyStream = new MediaStream(mediaStream.current.getAudioTracks());
    const recorder = new MediaRecorder(audioOnlyStream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        const formData = new FormData();
        formData.append("audio", e.data);
        formData.append("userId", socket.id);
        fetch("http://localhost:5000/upload", {
          method: "POST",
          body: formData,
        });
      }
    };

    recorder.start(5000);
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="call-container">
      <h1>🎙 Riverside Clone MVP</h1>

      {!joined ? (
        <div className="room-join">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      ) : (
        <>
          <div className="videos">
            <div>
              <h4>You</h4>
              <video ref={myVideo} autoPlay muted className="video-box" />
            </div>
            <div>
              <h4>Guest</h4>
              <video ref={userVideo} autoPlay className="video-box" />
            </div>
          </div>

          <div className="controls">
            {!recording ? (
              <button className="record-btn" onClick={startRecording}>
                🎙 Start Audio Recording
              </button>
            ) : (
              <button className="stop-btn" onClick={stopRecording}>
                🛑 Stop Recording
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AudioCallRecorder;
