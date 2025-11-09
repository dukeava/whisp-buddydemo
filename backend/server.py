from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.openai import OpenAIChatRealtime, OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage
import openai
import json
from elevenlabs.client import ElevenLabs
import base64
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI Setup
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Claude Setup
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')

# ElevenLabs Setup
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')
ELEVENLABS_VOICE_ID = os.environ.get('ELEVENLABS_VOICE_ID')
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

# Initialize Realtime Chat
realtime_chat = OpenAIChatRealtime(api_key=OPENAI_API_KEY)

# Initialize Whisper for STT
stt_client = OpenAISpeechToText(api_key=OPENAI_API_KEY)

# Create the main app
app = FastAPI()

# Create API router
api_router = APIRouter(prefix="/api")

# Models
class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    code: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectCreate(BaseModel):
    name: str
    description: str
    code: str

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: Optional[str] = None
    messages: List[dict]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationCreate(BaseModel):
    project_id: Optional[str] = None
    messages: List[dict]

class CodeGenerationRequest(BaseModel):
    conversation_history: List[dict]
    user_requirements: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "Whisp API Ready"}

@api_router.post("/projects", response_model=Project)
async def create_project(input: ProjectCreate):
    project_dict = input.model_dump()
    project_obj = Project(**project_dict)
    
    doc = project_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.projects.insert_one(doc)
    return project_obj

@api_router.get("/projects", response_model=List[Project])
async def get_projects():
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    for project in projects:
        if isinstance(project['created_at'], str):
            project['created_at'] = datetime.fromisoformat(project['created_at'])
        if isinstance(project['updated_at'], str):
            project['updated_at'] = datetime.fromisoformat(project['updated_at'])
    
    return projects

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if isinstance(project['created_at'], str):
        project['created_at'] = datetime.fromisoformat(project['created_at'])
    if isinstance(project['updated_at'], str):
        project['updated_at'] = datetime.fromisoformat(project['updated_at'])
    
    return project

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate):
    conversation_dict = input.model_dump()
    conversation_obj = Conversation(**conversation_dict)
    
    doc = conversation_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.conversations.insert_one(doc)
    return conversation_obj

@api_router.post("/generate-code")
async def generate_code(request: CodeGenerationRequest):
    try:
        # Build system prompt for code generation with buddy-like personality
        system_prompt = """You are Whisp, a super friendly conversational AI that builds apps through voice. You're like a buddy who's pumped to create cool stuff together.

Voice personality (CRITICAL - you're speaking, not typing):
- Sound natural and excited: "Alright! So I'm thinking...", "Ooh this is gonna be cool!"
- Ask clarifying questions like a friend: "Quick question though - do you want...", "Just wanna make sure I got this..."
- Confirm understanding: "So if I'm hearing you right...", "Let me see if I understand..."
- Guide the user: "When you're ready, just hit go and I'll build it!", "Press that play button when you wanna see it!"
- Celebrate progress: "Nice! That's gonna look awesome", "Okay okay, I'm seeing the vision!"

When user is ready to build, suggest: "Alright, I got everything I need! Hit that go button and let's make this happen!"

Code generation rules:
- Generate complete, self-contained HTML with inline CSS and JavaScript
- Make it beautiful, modern, and responsive
- Return ONLY the HTML code, no markdown formatting
- Include all functionality described"""
        
        # Prepare conversation for GPT-4o
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        # Add conversation history
        for msg in request.conversation_history[-5:]:  # Last 5 messages for context
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # Add final requirements
        messages.append({
            "role": "user",
            "content": f"Generate code for: {request.user_requirements}"
        })
        
        # Call GPT-4o
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=4000
        )
        
        generated_code = response.choices[0].message.content
        
        # Extract HTML if wrapped in markdown code blocks
        if "```html" in generated_code:
            generated_code = generated_code.split("```html")[1].split("```")[0].strip()
        elif "```" in generated_code:
            generated_code = generated_code.split("```")[1].split("```")[0].strip()
        
        return {
            "success": True,
            "code": generated_code,
            "message": "Code generated successfully"
        }
    
    except Exception as e:
        logging.error(f"Code generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ElevenLabs TTS Endpoint
class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None

# Dictational Mode Endpoints
class TranscribeRequest(BaseModel):
    audio_data: str  # base64 encoded audio

@api_router.post("/dictational/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper"""
    try:
        # Save audio to temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Transcribe using Whisper
        with open(temp_path, 'rb') as audio_file:
            response = await stt_client.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json"
            )
        
        # Clean up temp file
        import os as os_module
        os_module.unlink(temp_path)
        
        return {
            "success": True,
            "text": response.text
        }
    
    except Exception as e:
        logging.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class DictationalGenerateRequest(BaseModel):
    prompt: str
    session_id: str

@api_router.post("/dictational/generate")
async def dictational_generate(request: DictationalGenerateRequest):
    """Generate code using Claude Sonnet 4.5 with streaming"""
    try:
        async def generate_stream():
            # Initialize Claude chat
            claude_chat = LlmChat(
                api_key=CLAUDE_API_KEY,
                session_id=request.session_id,
                system_message="""You are Whisp's dictational mode - an AI that generates beautiful, functional web applications from voice descriptions.

Your task:
1. Generate complete, production-ready React/TypeScript applications
2. Create multiple files (components, styles, utilities as needed)
3. Make designs modern, beautiful, and responsive
4. Follow best practices and clean code principles

File structure format:
Return your response in this exact JSON format:
{
  "files": [
    {"path": "App.tsx", "content": "... tsx code here ..."},
    {"path": "styles.css", "content": "... css code here ..."}
  ],
  "summary": "Brief description of what was created"
}

Important:
- Always include all imports
- Make sure code is complete and runnable
- Use Tailwind CSS classes when possible
- Include proper TypeScript types"""
            ).with_model("anthropic", "claude-sonnet-4-20250514")
            
            # Send progress messages
            progress_messages = [
                "🎨 Analyzing your idea...",
                "⚙️ Creating app structure...",
                "✨ Generating components...",
                "🎯 Adding styles and interactions...",
                "🔧 Finalizing the build..."
            ]
            
            # Stream progress messages
            for msg in progress_messages:
                yield f"data: {json.dumps({'type': 'progress', 'message': msg})}\n\n"
                await asyncio.sleep(0.5)
            
            # Create user message
            user_message = UserMessage(text=request.prompt)
            
            # Get response from Claude
            response = await claude_chat.send_message(user_message)
            
            # Parse the response
            try:
                # Try to extract JSON from response
                response_text = response if isinstance(response, str) else str(response)
                
                logging.info(f"Claude response (first 500 chars): {response_text[:500]}")
                
                # Remove markdown code blocks if present
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0].strip()
                elif "```" in response_text:
                    # Try to find JSON block
                    parts = response_text.split("```")
                    for part in parts:
                        if "{" in part and "}" in part:
                            response_text = part.strip()
                            break
                
                # Find JSON in the response
                if "{" in response_text and "}" in response_text:
                    start_idx = response_text.find("{")
                    end_idx = response_text.rfind("}") + 1
                    json_str = response_text[start_idx:end_idx]
                    
                    logging.info(f"Extracted JSON: {json_str[:200]}...")
                    
                    result = json.loads(json_str)
                    
                    # Validate structure
                    if "files" not in result or not isinstance(result.get("files"), list):
                        raise ValueError("Invalid response structure - missing files array")
                    
                else:
                    # Fallback: create default structure
                    logging.warning("No JSON found in response, using fallback")
                    result = {
                        "files": [{"path": "App.tsx", "content": response_text}],
                        "summary": "Generated application based on your description"
                    }
                
                logging.info(f"Final result: {len(result.get('files', []))} files, summary length: {len(result.get('summary', ''))}")
                
                # Send completion with files
                yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
            
            except json.JSONDecodeError:
                # Fallback response
                fallback_result = {
                    'type': 'complete', 
                    'result': {
                        'files': [{'path': 'App.tsx', 'content': response}], 
                        'summary': 'Generated application based on your description'
                    }
                }
                yield f"data: {json.dumps(fallback_result)}\n\n"
        
        return StreamingResponse(generate_stream(), media_type="text/event-stream")
    
    except Exception as e:
        logging.error(f"Dictational generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/elevenlabs/tts")
async def generate_elevenlabs_tts(request: TTSRequest):
    """Generate speech using ElevenLabs with the configured voice"""
    try:
        voice_id = request.voice_id or ELEVENLABS_VOICE_ID
        
        # Generate audio using ElevenLabs with proper settings
        audio_generator = elevenlabs_client.text_to_speech.convert(
            text=request.text,
            voice_id=voice_id,
            model_id="eleven_turbo_v2_5",  # Faster, better quality
            output_format="mp3_44100_128"
        )
        
        # Collect audio data
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Convert to base64
        audio_b64 = base64.b64encode(audio_data).decode()
        
        return {
            "success": True,
            "audio": audio_b64,
            "format": "mp3"
        }
    
    except Exception as e:
        logging.error(f"ElevenLabs TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Register OpenAI Realtime router
OpenAIChatRealtime.register_openai_realtime_router(api_router, realtime_chat)

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()