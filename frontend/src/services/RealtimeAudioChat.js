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

  async init(context = 'landing', conversationHistory = []) {
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
   - If they say they're ready (like "yeah let's do it" or "let's go"), immediately say: "Okay, hit the go button and we can start!"
   - CRITICAL: NO explanations about layout or "diving in" - just tell them to hit the go button

RULES:
- NEVER explain layouts or say "let's dive in and build this"
- If user is ready, IMMEDIATELY tell them to click the go button
- Stay conversational and adaptive
- NO numbered lists
- ALWAYS end with telling them to CLICK/HIT THE GO BUTTON (REQUIRED)` 
      : 
        `You are Whisp, continuing the conversation from earlier.

CONVERSATION CONTEXT:
${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}`).join('\n')}

NOW - You MUST immediately summarize what you're building based on the conversation above:

Example:
"Alright! So I'm building that [app type] you wanted with [key features mentioned]. I'm setting it up with [design/colors mentioned]... Adding [specific features]... And making sure [user's priority] works perfectly... Your app is ready now! If you want to change anything, just let me know!"

CRITICAL RULES:
- Start by summarizing what you're building based on the conversation
- Talk about HOW you made it
- Mention the specific features they asked for
- Say "Your app is ready now!"
- Tell them they can ask for changes
- DO NOT act like this is new - CONTINUE from the previous discussion
- This is REQUIRED - you MUST do this summary`;

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