const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_PREFIX = `${BACKEND_URL}/api`;

class RealtimeAudioChat {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.audioElement = null;
    this.onTranscript = null;
  }

  async init(initialMessage = null) {
    try {
      // Get session from backend with instructions
      const tokenResponse = await fetch(`${API_PREFIX}/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "alloy",
          instructions: `You are Whisp, an enthusiastic and conversational AI buddy who helps people build apps through voice.

Your personality:
- Super friendly and excited ("Ooh that's cool!", "I love it!", "This is gonna be awesome!")
- Talk like a buddy, not a robot (use "you", "we", "gonna", "wanna")
- Ask clarifying questions naturally ("Quick question - do you want...", "Just to make sure...")
- Confirm understanding ("So if I'm hearing you right...", "Got it, so we're building...")
- Guide the conversation ("When you're ready, just hit that go button and we'll make it happen!")
- Celebrate progress ("This is turning out really cool!", "Almost there!")
- Be specific about what you're building and why it's cool

Important:
- Keep responses conversational and natural, like you're talking to a friend
- Don't be too formal or robotic
- Show excitement about what they want to build
- When they describe what they want, ask follow-up questions to understand better
- Once you have enough info, tell them to "hit the go button" or "click go"
- NEVER generate code in this conversation - just discuss and clarify the idea`
        })
      });
      
      const data = await tokenResponse.json();
      if (!data.client_secret?.value) {
        throw new Error("Failed to get session token");
      }

      // Create and set up WebRTC peer connection
      this.peerConnection = new RTCPeerConnection();
      this.setupAudioElement();
      await this.setupLocalAudio();
      this.setupDataChannel();

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to backend and get answer
      const response = await fetch(`${API_PREFIX}/realtime/negotiate`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "application/sdp"
        }
      });

      const { sdp: answerSdp } = await response.json();
      const answer = {
        type: "answer",
        sdp: answerSdp
      };

      await this.peerConnection.setRemoteDescription(answer);
      
      // Send initial message if provided
      if (initialMessage && this.dataChannel && this.dataChannel.readyState === 'open') {
        this.sendMessage(initialMessage);
      }
      
      console.log("WebRTC connection established");
    } catch (error) {
      console.error("Failed to initialize audio chat:", error);
      throw error;
    }
  }

  setupAudioElement() {
    this.audioElement = document.createElement("audio");
    this.audioElement.autoplay = true;
    document.body.appendChild(this.audioElement);

    this.peerConnection.ontrack = (event) => {
      this.audioElement.srcObject = event.streams[0];
    };
  }

  async setupLocalAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, stream);
    });
  }

  setupDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel("oai-events");
    
    this.dataChannel.onopen = () => {
      console.log("Data channel opened");
    };
    
    this.dataChannel.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log("Received event:", eventData);
        
        // Handle transcript events
        if (eventData.type === 'conversation.item.input_audio_transcription.completed') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, true);
          }
        } else if (eventData.type === 'response.audio_transcript.done') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, false);
          }
        } else if (eventData.type === 'response.done') {
          // Response completed
          console.log("Response completed");
        }
      } catch (error) {
        console.error("Error parsing event data:", error);
      }
    };
  }

  sendMessage(text) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const message = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: text
          }]
        }
      };
      this.dataChannel.send(JSON.stringify(message));
      
      // Trigger response
      this.dataChannel.send(JSON.stringify({ type: 'response.create' }));
    }
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.audioElement && this.audioElement.parentNode) {
      this.audioElement.parentNode.removeChild(this.audioElement);
    }
  }
}

export default RealtimeAudioChat;