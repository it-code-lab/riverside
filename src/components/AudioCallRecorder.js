import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("http://localhost:5000"); // backend

const AudioCallRecorder = () => {
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const mediaStream = useRef();
  const recorderRef = useRef();
  const [chunks, setChunks] = useState([]);
  const [recording, setRecording] = useState(false);

  const userId = window.location.hash.substring(1) || "userA";

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      mediaStream.current = stream;
      myVideo.current.srcObject = stream;
      myVideo.current.play();

      socket.emit("join", userId);

      socket.on("joined", ({ from }) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (data) => socket.emit("signal", { to: from, signal: data }));
        peer.on("stream", (remoteStream) => {
          userVideo.current.srcObject = remoteStream;
          userVideo.current.play();
        });
        socket.on("signal", ({ signal }) => peer.signal(signal));
        connectionRef.current = peer;
      });

      socket.on("initiate", ({ from }) => {
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peer.on("signal", (data) => socket.emit("signal", { to: from, signal: data }));
        peer.on("stream", (remoteStream) => {
          userVideo.current.srcObject = remoteStream;
          userVideo.current.play();
        });
        socket.on("signal", ({ signal }) => peer.signal(signal));
        connectionRef.current = peer;
      });
    });
  }, []);

  const startRecording = () => {
    const audioOnlyStream = new MediaStream(mediaStream.current.getAudioTracks());
    const recorder = new MediaRecorder(audioOnlyStream);
    const newChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        newChunks.push(e.data);
        uploadChunk(e.data);
      }
    };

    recorder.start(5000); // 5s chunks
    recorderRef.current = recorder;
    setChunks(newChunks);
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current.stop();
    setRecording(false);
  };

  const uploadChunk = async (blob) => {
    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("userId", userId);
    await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    });
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Audio Call + Local Audio Recording</h2>
      <video ref={myVideo} muted style={{ width: "300px", margin: "10px" }} />
      <video ref={userVideo} style={{ width: "300px", margin: "10px" }} />
      <div style={{ marginTop: "20px" }}>
        {!recording ? (
          <button onClick={startRecording}>Start Audio Recording</button>
        ) : (
          <button onClick={stopRecording}>Stop Recording</button>
        )}
      </div>
    </div>
  );
};

export default AudioCallRecorder;
