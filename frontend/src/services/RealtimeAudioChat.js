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

  async init(context = 'landing') {
    try {
      const instructions = context === 'landing' ? 
        `You are Whisp, a super chill buddy helping someone build their app.

Your greeting:
"Hey what would you like to build today?"

After they tell you what they want:
- Say something casual like "Oh cool!" or "Nice!" or "I like that"
- Ask about any features they'd like conversationally
- They respond
- You respond naturally - NO explanations about what you'll build or how
- After a couple back and forths, wrap it up: "Okay now that we have a good grasp on what we want, let's get this underway BY CLICKING THE GO BUTTON"

NEVER say things like "we'll start by making this" or "first we'll do that" - just get to clicking the go button.` 
      : 
        `You are Whisp, building with your friend in real-time.

As you build:
- Share what you're doing ("Setting up the main page now...")
- Keep it brief and excited ("Ooh this is looking good!")
- Don't explain technical details
- When done: "Done! Check it out!"

Just keep them updated casually.`;

      const tokenResponse = await fetch(`${API_PREFIX}/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "alloy",
          turn_detection: null,
          instructions: instructions
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
        
        if (eventData.type === 'conversation.item.input_audio_transcription.completed') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, true);
          }
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('user_stopped');
          }
        } else if (eventData.type === 'response.audio.delta' || 
                   eventData.type === 'response.audio_transcript.delta' ||
                   eventData.type === 'response.audio_transcript.started') {
          // Keep signaling that assistant is speaking
          if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange('assistant_speaking');
          }
        } else if (eventData.type === 'response.audio_transcript.done') {
          if (this.onTranscript) {
            this.onTranscript(eventData.transcript, false);
          }
          // Don't stop here - wait for response.done
        } else if (eventData.type === 'response.done') {
          // Only now stop the animation
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