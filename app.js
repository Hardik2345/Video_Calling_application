const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const http = require("http");
const twilio = require("twilio");
const { connected } = require("process");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/get-turn-credentials", (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_ACCOUNT_AUTH;
  const client = twilio(accountSid, authToken);

  client.tokens
    .create()
    .then((token) => {
      res.send({ token });
    })
    .catch((err) => {
      console.log(err);
      res.send({ message: "failed to fetch TURN credentials", err });
    });
});

let connectedPeers = [];

io.on("connection", (socket) => {
  connectedPeers.push(socket.id);

  socket.on("pre-offer", (data) => {
    const { calleePersonalCode, callType } = data;

    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId == calleePersonalCode
    );
    console.log(connectedPeers);

    if (connectedPeer) {
      const data = {
        callerSocketId: socket.id,
        callType,
      };
      io.to(calleePersonalCode).emit("pre-offer", data);
    } else {
      const data = {
        preOfferAnswer: "CALLEE_NOT_FOUND",
      };
      io.to(socket.id).emit("pre-offer-answer", data);
    }
  });

  socket.on("pre-offer-answer", (data) => {
    console.log("pre offer answer");
    console.log(data);

    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId == data.callerSocketId
    );

    if (connectedPeer) {
      io.to(data.callerSocketId).emit("pre-offer-answer", data);
    }
  });

  socket.on("webRTC-signaling", (data) => {
    const { connectedUserSocketId } = data;
    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId == connectedUserSocketId
    );

    if (connectedPeer) {
      io.to(connectedUserSocketId).emit("webRTC-signaling", data);
    }
  });

  socket.on("user-hanged-up", (data) => {
    const { connectedUserSocketId } = data;
    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId == connectedUserSocketId
    );
    if (connectedPeer) {
      io.to(connectedUserSocketId).emit("user-hanged-up");
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");

    const newConnectedPeers = connectedPeers.filter(
      (peerSocketId) => peerSocketId != socket.id
    );

    connectedPeers = newConnectedPeers;
  });
});

server.listen(PORT, () => {
  console.log("App running on port 3000...");
});
