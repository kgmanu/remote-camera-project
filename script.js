const firebaseConfig = {
  apiKey: "AIzaSyDPboB-NOAKfFf2uh9vd0s2zMbezX6-iAg",
  authDomain: "mmaannuu11223344.firebaseapp.com",
  projectId: "mmaannuu11223344",
  storageBucket: "mmaannuu11223344.firebasestorage.app",
  messagingSenderId: "546810073036",
  appId: "1:546810073036:web:d1547fe7db422475199769"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let pc = new RTCPeerConnection(servers);
let localStream;

// ---------------- SENDER ----------------
async function startStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  document.getElementById("localVideo").srcObject = localStream;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const callDoc = db.collection("calls").doc("room1");
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  pc.onicecandidate = event => {
    if (event.candidate) {
      offerCandidates.add(event.candidate.toJSON());
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  await callDoc.set({
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp
    }
  });

  // listen for answer
  callDoc.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // listen for ICE from viewer
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

// ---------------- VIEWER ----------------
async function viewStream() {
  const callDoc = db.collection("calls").doc("room1");
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  pc.ontrack = event => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      answerCandidates.add(event.candidate.toJSON());
    }
  };

  const callData = (await callDoc.get()).data();
  if (!callData?.offer) {
    alert("Start sender first!");
    return;
  }

  await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  await callDoc.update({
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp
    }
  });

  offerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

