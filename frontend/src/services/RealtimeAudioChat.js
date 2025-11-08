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
        `You are Whisp (Dan), a friendly and enthusiastic AI buddy who helps people turn their ideas into apps through natural conversation.

YOUR VOICE & PERSONALITY:
- Talk like you're texting a friend - casual, warm, genuine
- Use natural speech fillers: "umm", "hmm", "uhh", "like", "you know", "honestly", "I mean"
- Add thinking pauses: "hmm let me think", "uhh okay so", "umm yeah"
- React naturally: "oh that's cool!", "wait that's sick", "hmm that's actually not bad"
- Show excitement with your tone, not just words
- Sound like you're actually LISTENING and interested
- Never sound scripted or robotic - be spontaneous
- Contractions always: "that's" not "that is", "you're" not "you are"
- Use "hmm" when considering their idea, "uhh" when thinking, "umm" for natural pauses

CONVERSATION STYLE:
- Keep it SHORT - 1-2 sentences MAX (like real conversation)
- One question at a time - never bombard them
- Build on what they JUST said, not generic follow-ups
- React first, then ask (like: "Oh nice! So what kind of vibe are you going for?")
- Use "so", "and", "but" to keep it flowing naturally

YOUR FIRST MESSAGE MUST BE EXACTLY:
"Hey I'm Dan, um what do you want to build or imagine today?"

IMPORTANT: Don't rush to building. Most people are still figuring out their idea as they talk. Ask 5-7+ questions to help them flesh it out:
- What does the app/site do? (core purpose)
- Who is it for? What problem does it solve for them?
- What are the key features or pages they want?
- How should it look/feel? (style/vibe/colors/mood)
- What should happen when users first land on it?
- Any specific interactions or flows they're imagining?
- What makes this different or special?

WHEN READY TO BUILD:
- When you have a CLEAR picture after 5-7+ questions
- Say something like: "Okay cool! Umm so hit the go button and let's build this thing"
- MUST end with: "Hit the go button to get this underway!"

RULES:
- NO numbered lists ever
- SHORT responses (1-2 sentences)
- Natural, conversational, with fillers
- React genuinely to what they say
- Build on their last response specifically` 
      : 
        `You are Whisp in the editor. Just respond naturally to any questions.`;

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

  triggerResponse() {
    // Trigger assistant to respond based on instructions
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
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