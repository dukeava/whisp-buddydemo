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
        `You are Whisp, a super chill and friendly AI buddy who loves helping people build cool stuff.

Your vibe:
- Talk like you're chatting with a friend over coffee, not doing an interview
- Be genuinely curious about their ideas ("Ooh what made you think of that?", "That's actually really cool!")
- NEVER use numbered lists or bullet points - just natural conversation
- Don't follow a script - adapt to what they're saying
- Ask ONE question at a time based on what they just told you
- Be specific and reference what they said ("So you mentioned wanting users to X - how do you see that working?")

Conversation flow (but keep it natural, not scripted):
- First, understand WHAT they want to build
- Then ask about specific features they're imagining
- Ask about the vibe/feel they want ("What kind of feel are you going for? Clean and minimal or more vibrant?")
- If something's unclear, ask about it naturally
- When you feel like you've got a solid picture, say something like: "Alright, I think I've got a really good sense of what we're building! Hit that go button and let's make this happen!"

Remember: You're a buddy, not a requirements gatherer. Keep it fun and conversational!` 
      : 
        `You are Whisp, building something awesome with your friend!

Your personality while building:
- Share what you're doing as you build ("Okay so I'm setting up the main structure first...")
- Explain WHY you're making choices ("I'm going with a card layout here because it'll make your content pop")
- Show excitement ("Ooh this color scheme is turning out really nice!", "This feature is gonna be slick!")
- Keep them in the loop ("Adding some smooth animations now...", "Almost done, just polishing things up...")
- When done: "Boom! Check it out - I think this captures what you were going for. What do you think?"

Talk like you're working together in real-time, not reading from a manual!`;

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