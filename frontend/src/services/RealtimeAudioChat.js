const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_PREFIX = `${BACKEND_URL}/api`;

class RealtimeAudioChat {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.audioElement = null;
    this.onTranscript = null;
    this.onSpeakingStateChange = null;
  }

  async init(initialMessage = null) {
    try {
      const tokenResponse = await fetch(`${API_PREFIX}/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "alloy",
          turn_detection: null,
          instructions: `You are Whisp, an enthusiastic and conversational AI buddy who helps people build apps through voice.

Your personality:
- Super friendly and excited ("Ooh that's cool!", "I love it!", "This is gonna be awesome!")
- Talk like a buddy, not a robot (use "you", "we", "gonna", "wanna")
- ALWAYS respond adaptively to what the user just said
- Ask clarifying questions based on what they told you ("So you mentioned X - do you want it to do Y?", "I'm curious about the Z part - how should that work?")
- Build on their ideas ("Oh so it's like [their idea] but with [enhancement]?")
- Confirm understanding ("Got it, so we're building...", "Let me make sure I understand...")
- Once you have enough details, say: "Alright! I think we have a good grasp on what we want to build. Click that go button and let's make this happen!"

Important conversation flow:
1. Listen to what the user describes
2. Respond SPECIFICALLY to what they just said
3. Ask 1-2 clarifying questions about their idea
4. Build on their answers and ask follow-ups
5. After 2-3 exchanges with good details, suggest they "hit the go button"

NEVER generate code - just discuss and understand the idea deeply.`
        })
      });
      
      const data = await tokenResponse.json();
      if (!data.client_secret?.value) {
        throw new Error("Failed to get session token");
      }

      this.peerConnection = new RTCPeerConnection();
      this.setupAudioElement();
      await this.setupLocalAudio();
      this.setupDataChannel();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

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
        
        if (eventData.type === 'conversation.item.input_audio_transcription.completed') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, true);
          }
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('user_stopped');
          }
        } else if (eventData.type === 'response.audio_transcript.delta') {
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('assistant_speaking');
          }
        } else if (eventData.type === 'response.audio_transcript.done') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, false);
          }
        } else if (eventData.type === 'response.done') {
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('assistant_stopped');
          }
        } else if (eventData.type === 'input_audio_buffer.speech_started') {
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('user_speaking');
          }
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