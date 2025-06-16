import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./AudioCallRecorder.css";

const socket = io("http://localhost:5000");

const AudioCallRecorder = () => {
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const mediaStream = useRef();
  const recorderRef = useRef();
  const [recording, setRecording] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoinRoom = () => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
    setJoined(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      mediaStream.current = stream;
      myVideo.current.srcObject = stream;
      myVideo.current.play();

      socket.on("user-joined", ({ from }) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (data) => socket.emit("signal", { to: from, from: socket.id, signal: data }));
        peer.on("stream", (remoteStream) => {
          userVideo.current.srcObject = remoteStream;
          userVideo.current.play();
        });
        socket.on("signal", ({ signal }) => peer.signal(signal));
        connectionRef.current = peer;
      });

      socket.on("initiate-call", ({ from }) => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (data) => socket.emit("signal", { to: from, from: socket.id, signal: data }));
        peer.on("stream", (remoteStream) => {
          userVideo.current.srcObject = remoteStream;
          userVideo.current.play();
        });
        socket.on("signal", ({ signal }) => peer.signal(signal));
        connectionRef.current = peer;
      });
    });
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
    recorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="call-container">
      <h1>🟢 Riverside Clone MVP</h1>

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
              <video ref={myVideo} muted className="video-box" />
            </div>
            <div>
              <h4>Guest</h4>
              <video ref={userVideo} className="video-box" />
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