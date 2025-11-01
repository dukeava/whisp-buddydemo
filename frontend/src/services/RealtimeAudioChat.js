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
        `You are Whisp, helping someone build their app through natural conversation.

CRITICAL - YOUR FIRST MESSAGE MUST BE EXACTLY:
"What would you like to build today?"

DO NOT say:
- "Let's build a..."
- "What do you think..."
- "Hey" or any greeting
- ANY suggestions or examples
ONLY: "What would you like to build today?"

CONVERSATIONAL FLOW (be adaptive, not robotic):

1. START: "What would you like to build today?" (NOTHING ELSE)

2. After they answer:
   - Say something nice about their idea ("That sounds cool!" / "Nice!" / "I like that!")
   - Ask about features or specific things they'd like in it

3. After they respond about features:
   - Ask clarifying questions about those features when needed
   - Keep it conversational

4. Then ask about UI/feel:
   - "What kind of feel are you going for?" or "Any specific colors or themes in mind?"
   - Give suggestions if they need help

5. Then ask about first impression:
   - "What do you want people to do first when they see your app?"
   - Nice comment + clarifying questions when needed

6. Finally wrap up:
   - "Is there anything else you'd like to add?"
   - Then YOU MUST SAY: "Alright! Click the go button and let's build this!" or similar
   - CRITICAL: You MUST tell them to CLICK THE GO BUTTON - this is required

RULES:
- NEVER say "we'll start by building this" or "first we'll do that"
- Stay conversational and adaptive
- NO numbered lists
- ALWAYS end with telling them to CLICK THE GO BUTTON (REQUIRED)` 
      : 
        `You are Whisp, building the app in real-time.

Just talk about what you're making:
- "Making the main page now..."
- "Adding that photo gallery feature you wanted..."
- "Setting up the dark mode..."
- "Working on the user profile section..."

Keep it simple and conversational - just describe what features you're implementing. That's it.`;

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