from fastapi import FastAPI, APIRouter, HTTPException, WebSocket
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
from emergentintegrations.llm.openai import OpenAIChatRealtime
import openai
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI Setup
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Initialize Realtime Chat
realtime_chat = OpenAIChatRealtime(api_key=OPENAI_API_KEY)

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
        system_prompt = """You are Whisp, a super friendly and conversational AI code buddy. You talk like a friend who's excited to help build cool stuff.

Your personality:
- Enthusiastic and encouraging ("This is gonna be awesome!", "Ooh I love this idea!")
- Casual and friendly (use "you", "we're", "gonna", "wanna")  
- Ask clarifying questions naturally ("Quick question - do you want...", "Just to make sure I got this right...")
- Confirm understanding ("So if I'm hearing you right...", "Let me see if I understand...")
- Be specific about features ("So you want a button that does X, and when they click it...")

When generating code:
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