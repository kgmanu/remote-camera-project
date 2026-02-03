// 🔹 Replace this with your Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let pc = new RTCPeerConnection(servers);
let localStream = null;

// Sender function
async function startStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  document.getElementById("localVideo").srcObject = localStream;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await db.collection("calls").doc("room1").set({
    offer: { type: offer.type, sdp: offer.sdp }
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      db.collection("calls").doc("room1")
        .collection("candidates")
        .add(event.candidate.toJSON());
    }
  };
}

// Viewer function
async function viewStream() {
  const callDoc = db.collection("calls").doc("room1");
  const callData = (await callDoc.get()).data();

  await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await callDoc.update({
    answer: { type: answer.type, sdp: answer.sdp }
  });

  callDoc.collection("candidates").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  pc.ontrack = event => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };
}
