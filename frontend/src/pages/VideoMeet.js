import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {  IconButton, TextField } from "@mui/material";
import { Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import server from "../environment";
import Badge from "@mui/material/Badge";
import { useLocation } from "react-router-dom";

const server_url = server;

var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  var socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoref = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);

  let [audioAvailable, setAudioAvailable] = useState(true);

  let [video, setVideo] = useState([]);

  let [audio, setAudio] = useState();

  let [screen, setScreen] = useState();

  let [showModal, setModal] = useState(true);

  let [screenAvailable, setScreenAvailable] = useState();

  let [messages, setMessages] = useState([]);

  let [message, setMessage] = useState("");

  let [newMessages, setNewMessages] = useState(0); // start at 0

  let [askForUsername, setAskForUsername] = useState(true);

  let [username, setUsername] = useState("");

  const videoRef = useRef([]);

  let [videos, setVideos] = useState([]);

  // Add a state to track chat open/close for layout
  let [isChatOpen, setIsChatOpen] = useState(false); // chat hidden by default

  const location = useLocation();

  // Get username from query param if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const uname = params.get("username");
    if (uname) setUsername(uname);
  }, [location.search]);

  // TODO
  // if(isChrome() === false) {

  // }

  useEffect(() => {
    console.log("HELLO");
    getPermissions();
  });

  let getDislayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
        console.log("Video permission granted");
      } else {
        setVideoAvailable(false);
        console.log("Video permission denied");
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
        console.log("Audio permission granted");
      } else {
        setAudioAvailable(false);
        console.log("Audio permission denied");
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
      console.log("SET STATE HAS ", video, audio);
    }
  }, [video, audio]);
  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        console.log(description);
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          // Fallback: avatar video + silent audio
          const initial = username && username.length > 0 ? username[0].toUpperCase() : "U";
          const avatar = avatarTrack(initial);
          const silent = silence();
          const fallbackStream = new MediaStream([avatar, silent]);
          window.localStream = fallbackStream;
          localVideoref.current.srcObject = fallbackStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        })
    );
  };

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  let getDislayMediaSuccess = (stream) => {
    console.log("HERE");
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          // Fallback: avatar video + silent audio
          const initial = username && username.length > 0 ? username[0].toUpperCase() : "U";
          const avatar = avatarTrack(initial);
          const silent = silence();
          const fallbackStream = new MediaStream([avatar, silent]);
          window.localStream = fallbackStream;
          localVideoref.current.srcObject = fallbackStream;

          getUserMedia();
        })
    );
  };

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      // Always send username when joining
      socketRef.current.emit("join-call", window.location.href, username);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients, usernames = {}) => {
        // Update usernames for all videos
        setVideos((videos) =>
          videos.map((video) => ({
            ...video,
            username: usernames[video.socketId] || video.username || "User",
          }))
        );

        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );
          // Wait for their ice candidate
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Wait for their video stream
          connections[socketListId].onaddstream = (event) => {
            console.log("BEFORE:", videoRef.current);
            console.log("FINDING ID: ", socketListId);

            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId
            );

            if (videoExists) {
              console.log("FOUND EXISTING");

              // Update the stream of the existing video
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              // Create a new video
              console.log("CREATING NEW");
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
                username: usernames[socketListId] || "User"
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          // Add the local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            // Fallback: avatar video + silent audio
            const initial = username && username.length > 0 ? username[0].toUpperCase() : "U";
            const avatar = avatarTrack(initial);
            const silent = silence();
            const fallbackStream = new MediaStream([avatar, silent]);
            window.localStream = fallbackStream;
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  // Helper to create a silent audio track
  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  // Helper to create a video track with user's avatar (initial)
  let avatarTrack = (initial = "U", bgColor = "#3949ab", textColor = "#fff") => {
    const size = 480;
    const canvas = Object.assign(document.createElement("canvas"), {
      width: size,
      height: size,
    });
    const ctx = canvas.getContext("2d");
    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    // Circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, 2 * Math.PI);
    ctx.fillStyle = bgColor;
    ctx.fill();
    // Initial
    ctx.font = "bold 200px Arial";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, size / 2, size / 2 + 20);
    // "Video is off" text
    ctx.font = "bold 40px Arial";
    ctx.fillStyle = "#bbb";
    ctx.fillText("Video is off", size / 2, size - 60);

    const stream = canvas.captureStream();
    const track = stream.getVideoTracks()[0];
    track.enabled = true;
    return track;
  };

  // Store avatar track for reuse while video is off
  let avatarVideoTrackRef = { current: null };

  let handleVideo = () => {
    setVideo((prev) => {
      const newVideoState = !prev;
      if (!newVideoState) {
        // Video OFF: stop all video tracks and remove from stream and release camera
        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            let tracks = localVideoref.current.srcObject.getVideoTracks();
            tracks.forEach((track) => track.stop());
          }
          if (window.localStream) {
            window.localStream.getVideoTracks().forEach((track) => {
              window.localStream.removeTrack(track);
              track.stop();
            });
          }
          if (localVideoref.current) {
            localVideoref.current.srcObject = window.localStream;
          }
        } catch (e) {
          console.log(e);
        }
        // Replace outgoing video track for all peers with a dummy (blank) track
        for (let id in connections) {
          const sender = connections[id]
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) {
            const canvas = document.createElement("canvas");
            canvas.width = 16;
            canvas.height = 16;
            const stream = canvas.captureStream();
            const dummyTrack = stream.getVideoTracks()[0];
            sender.replaceTrack(dummyTrack);
          }
        }
      } else {
        // Video ON: get real video and add to stream and show in local video
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          const realTrack = stream.getVideoTracks()[0];
          // Add to local stream
          if (window.localStream) {
            window.localStream.getVideoTracks().forEach((track) => {
              window.localStream.removeTrack(track);
              track.stop();
            });
            window.localStream.addTrack(realTrack);
          } else {
            window.localStream = new MediaStream([realTrack]);
          }
          if (localVideoref.current) {
            localVideoref.current.srcObject = window.localStream;
          }
          // Replace outgoing video track for all peers
          for (let id in connections) {
            const sender = connections[id]
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(realTrack);
            }
          }
        });
      }
      return newVideoState;
    });
  };
  let handleAudio = () => {
    setAudio((prev) => {
      const newAudioState = !prev;
      if (!newAudioState) {
        // Audio OFF: stop all audio tracks and remove from stream
        if (window.localStream) {
          window.localStream.getAudioTracks().forEach((track) => {
            track.stop();
            window.localStream.removeTrack(track);
          });
        }
        // Replace outgoing audio track for all peers with a silent track
        for (let id in connections) {
          const sender = connections[id]
            .getSenders()
            .find((s) => s.track && s.track.kind === "audio");
          if (sender) {
            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            ctx.resume();
            const silentTrack = dst.stream.getAudioTracks()[0];
            silentTrack.enabled = false;
            sender.replaceTrack(silentTrack);
          }
        }
      } else {
        // Audio ON: get real audio and add to stream
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const realTrack = stream.getAudioTracks()[0];
          // Add to local stream
          if (window.localStream) {
            window.localStream.getAudioTracks().forEach((track) => {
              window.localStream.removeTrack(track);
              track.stop();
            });
            window.localStream.addTrack(realTrack);
          }
          // Replace outgoing audio track for all peers
          for (let id in connections) {
            const sender = connections[id]
              .getSenders()
              .find((s) => s.track && s.track.kind === "audio");
            if (sender) {
              sender.replaceTrack(realTrack);
            }
          }
        });
      }
      return newAudioState;
    });
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDislayMedia();
    }
  }, [screen]);
  let handleScreen = () => {
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = "/";
  };

  let openChat = () => {
    setModal(true);
    setNewMessages(0);
  };
  let closeChat = () => {
    setModal(false);
  };
  let handleMessage = (e) => {
    setMessage(e.target.value);
  };

  // Only increment newMessages if chat is closed
  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current && !isChatOpen) {
      setNewMessages((prevNewMessages) => prevNewMessages + 1);
    }
  };

  // Open chat: reset newMessages
  const handleOpenChat = () => {
    setIsChatOpen(true);
    setNewMessages(0);
  };

  // Close chat
  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  let sendMessage = () => {
    console.log(socketRef.current);
    socketRef.current.emit("chat-message", message, username);
    setMessage("");

    // this.setState({ message: "", sender: username })
  };

  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  // Helper: Self video always first
  const renderSelfVideo = () => (
    <div key="self" className={styles.videoBox}>
      {video ? (
        <video
          className={styles.gridVideo}
          ref={localVideoref}
          autoPlay
          muted
          style={{ background: "#111", objectFit: "contain" }}
        ></video>
      ) : (
        <div className={styles.videoOffPlaceholder}>
          <div className={styles.avatarCircle}>
            {username && username.length > 0 ? username[0].toUpperCase() : "U"}
          </div>
          <div className={styles.videoOffText}>Video is off</div>
        </div>
      )}
      {/* Username label removed */}
    </div>
  );

  // Helper: Render participant videos
  const renderParticipantVideos = () =>
    videos.map((videoObj) => (
      <div key={videoObj.socketId} className={styles.videoBox}>
        {videoObj.stream && videoObj.stream.getVideoTracks().length > 0 && videoObj.stream.getVideoTracks()[0].enabled ? (
          <video
            className={styles.gridVideo}
            data-socket={videoObj.socketId}
            ref={(ref) => {
              if (ref && videoObj.stream) {
                ref.srcObject = videoObj.stream;
              }
            }}
            autoPlay
            style={{ background: "#111", objectFit: "contain" }}
          ></video>
        ) : (
          <div className={styles.videoOffPlaceholder}>
            <div className={styles.avatarCircle}>
              {videoObj.username && videoObj.username.length > 0
                ? videoObj.username[0].toUpperCase()
                : "U"}
            </div>
            <div className={styles.videoOffText}>Video is off</div>
          </div>
        )}
        {/* Username label removed */}
      </div>
    ));

  // --- UI ---
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {askForUsername === true ? (
        <div>
          <h2>Enter into Lobby </h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>

          <div>
            <video ref={localVideoref} autoPlay muted></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {isChatOpen ? (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 20px 0 20px" }}>
                  <h1 style={{ fontWeight: 700, fontSize: "2rem", margin: 0 }}>Chat</h1>
                  <Button onClick={handleCloseChat} style={{ minWidth: 32, fontWeight: 700, color: "#1a237e" }}>×</Button>
                </div>
                <div className={styles.chattingDisplay}>
                  {messages.length !== 0 ? (
                    messages.map((item, index) => (
                      <div className={styles.chatMessage} key={index}>
                        <div className={styles.chatSender}>{item.sender}</div>
                        <div>{item.data}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#888", textAlign: "center", marginTop: "40px", fontSize: "1.1em" }}>
                      No messages yet
                    </div>
                  )}
                </div>
                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    id="outlined-basic"
                    placeholder="Type your message..."
                    variant="outlined"
                    size="small"
                    sx={{
                      flex: 1,
                      background: "#f7f8fa",
                      borderRadius: "8px",
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={sendMessage}
                    className={styles.sendButton}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Video grid */}
          <div
            className={
              isChatOpen
                ? styles.conferenceView
                : `${styles.conferenceView} ${styles.fullWidth}`
            }
            style={{ position: "relative", zIndex: 1 }}
          >
            {renderSelfVideo()}
            {renderParticipantVideos()}
          </div>

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            {screenAvailable === true ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : null}
            <div style={{ display: "inline-block", position: "relative" }}>
              <Badge
                badgeContent={newMessages > 0 ? newMessages : null}
                classes={{ badge: styles.customBadge }}
                overlap="circular"
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                invisible={newMessages === 0}
              >
                <IconButton
                  onClick={handleOpenChat}
                  style={{ color: "white", position: "relative" }}
                >
                  <ChatIcon />
                </IconButton>
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}