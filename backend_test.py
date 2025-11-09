import requests
import sys
import json
from datetime import datetime
import io
import wave
import struct

class WhispAPITester:
    def __init__(self, base_url="https://whisp-buddy.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            self.test_results.append({
                "name": name,
                "success": success,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "response_preview": response.text[:100] if not success else "OK"
            })

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_create_project(self):
        """Test project creation"""
        project_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "A test project for API testing",
            "code": "<html><body><h1>Test</h1></body></html>"
        }
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,  # Based on the code, it should return 200, not 201
            data=project_data
        )
        return response.get('id') if success else None

    def test_get_projects(self):
        """Test getting all projects"""
        return self.run_test("Get All Projects", "GET", "projects", 200)

    def test_get_project(self, project_id):
        """Test getting a specific project"""
        if not project_id:
            print("⚠️  Skipping get project test - no project ID available")
            return False
        return self.run_test(f"Get Project {project_id}", "GET", f"projects/{project_id}", 200)

    def test_create_conversation(self):
        """Test conversation creation"""
        conversation_data = {
            "project_id": None,
            "messages": [
                {"role": "user", "content": "Hello, I want to build a website"},
                {"role": "assistant", "content": "Great! What kind of website would you like to build?"}
            ]
        }
        success, response = self.run_test(
            "Create Conversation",
            "POST",
            "conversations",
            200,  # Based on the code, it should return 200
            data=conversation_data
        )
        return response.get('id') if success else None

    def test_generate_code(self):
        """Test code generation endpoint"""
        code_request = {
            "conversation_history": [
                {"role": "user", "content": "I want to build a simple landing page"},
                {"role": "assistant", "content": "I'll help you create a landing page"}
            ],
            "user_requirements": "Create a simple landing page with a header, hero section, and footer"
        }
        return self.run_test(
            "Generate Code",
            "POST",
            "generate-code",
            200,
            data=code_request
        )

    def test_realtime_session(self):
        """Test OpenAI Realtime session endpoint"""
        return self.run_test(
            "Realtime Session",
            "POST",
            "realtime/session",
            200
        )

    def test_realtime_negotiate(self):
        """Test OpenAI Realtime negotiate endpoint"""
        # This endpoint expects SDP data, so we'll test with minimal SDP
        test_sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
        headers = {'Content-Type': 'application/sdp'}
        
        url = f"{self.api_url}/realtime/negotiate"
        print(f"\n🔍 Testing Realtime Negotiate...")
        print(f"   URL: {url}")
        
        try:
            response = requests.post(url, data=test_sdp, headers=headers, timeout=10)
            self.tests_run += 1
            
            # This might return various status codes depending on the SDP validation
            if response.status_code in [200, 400, 422]:  # Accept these as valid responses
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code} (endpoint accessible)")
                print(f"   Response: {response.text[:200]}...")
                return True
            else:
                print(f"❌ Failed - Status: {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def create_test_audio_file(self):
        """Create a simple test audio file (WAV format)"""
        # Create a simple 1-second audio file with a sine wave
        sample_rate = 16000
        duration = 1  # seconds
        frequency = 440  # Hz (A4 note)
        
        # Generate sine wave
        samples = []
        for i in range(sample_rate * duration):
            value = int(32767 * 0.3 * (i % (sample_rate // frequency)) / (sample_rate // frequency))
            samples.append(value)
        
        # Create WAV file in memory
        audio_buffer = io.BytesIO()
        with wave.open(audio_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(struct.pack('h' * len(samples), *samples))
        
        audio_buffer.seek(0)
        return audio_buffer

    def test_dictational_transcribe(self):
        """Test dictational transcribe endpoint"""
        url = f"{self.api_url}/dictational/transcribe"
        self.tests_run += 1
        print(f"\n🔍 Testing Dictational Transcribe...")
        print(f"   URL: {url}")
        
        try:
            # Create test audio file
            audio_file = self.create_test_audio_file()
            
            # Send as multipart/form-data
            files = {'file': ('test_audio.wav', audio_file, 'audio/wav')}
            response = requests.post(url, files=files, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check for required fields
                if 'success' in response_data and 'text' in response_data:
                    if response_data['success'] == True:
                        self.tests_passed += 1
                        print(f"✅ Passed - Transcription successful")
                        print(f"   Transcribed text: {response_data['text']}")
                        self.test_results.append({
                            "name": "Dictational Transcribe",
                            "success": True,
                            "status_code": 200,
                            "transcribed_text": response_data['text']
                        })
                        return True
                    else:
                        print(f"❌ Failed - success field is False")
                        self.test_results.append({
                            "name": "Dictational Transcribe",
                            "success": False,
                            "error": "success field is False"
                        })
                        return False
                else:
                    print(f"❌ Failed - Missing required fields (success, text)")
                    self.test_results.append({
                        "name": "Dictational Transcribe",
                        "success": False,
                        "error": "Missing required fields"
                    })
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                self.test_results.append({
                    "name": "Dictational Transcribe",
                    "success": False,
                    "status_code": response.status_code,
                    "response": response.text[:200]
                })
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": "Dictational Transcribe",
                "success": False,
                "error": str(e)
            })
            return False

    def test_dictational_generate(self):
        """Test dictational generate endpoint with streaming response"""
        url = f"{self.api_url}/dictational/generate"
        self.tests_run += 1
        print(f"\n🔍 Testing Dictational Generate...")
        print(f"   URL: {url}")
        
        try:
            # Prepare request data
            request_data = {
                "prompt": "create a simple hello world app with a button",
                "session_id": "test-session-123"
            }
            
            # Send request with streaming enabled
            response = requests.post(
                url, 
                json=request_data, 
                headers={'Content-Type': 'application/json'},
                stream=True,
                timeout=60
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                # Parse streaming response
                progress_messages = []
                completion_data = None
                
                print(f"   Streaming response:")
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        print(f"     {line_str[:100]}...")
                        
                        # Parse SSE format (data: {...})
                        if line_str.startswith('data: '):
                            json_str = line_str[6:]  # Remove 'data: ' prefix
                            try:
                                data = json.loads(json_str)
                                
                                if data.get('type') == 'progress':
                                    progress_messages.append(data.get('message'))
                                    print(f"     📝 Progress: {data.get('message')}")
                                elif data.get('type') == 'complete':
                                    completion_data = data.get('result')
                                    print(f"     ✅ Complete: {json.dumps(completion_data, indent=2)[:200]}...")
                            except json.JSONDecodeError:
                                print(f"     ⚠️  Could not parse JSON: {json_str[:100]}")
                
                # Validate response
                if completion_data:
                    if 'files' in completion_data and 'summary' in completion_data:
                        # Check files structure
                        files = completion_data['files']
                        if isinstance(files, list) and len(files) > 0:
                            # Check first file has path and content
                            first_file = files[0]
                            if 'path' in first_file and 'content' in first_file:
                                self.tests_passed += 1
                                print(f"✅ Passed - Generate endpoint working correctly")
                                print(f"   Progress messages: {len(progress_messages)}")
                                print(f"   Files generated: {len(files)}")
                                print(f"   Summary: {completion_data['summary']}")
                                self.test_results.append({
                                    "name": "Dictational Generate",
                                    "success": True,
                                    "status_code": 200,
                                    "progress_count": len(progress_messages),
                                    "files_count": len(files)
                                })
                                return True
                            else:
                                print(f"❌ Failed - Files missing path or content fields")
                                self.test_results.append({
                                    "name": "Dictational Generate",
                                    "success": False,
                                    "error": "Files missing required fields"
                                })
                                return False
                        else:
                            print(f"❌ Failed - Files array is empty or invalid")
                            self.test_results.append({
                                "name": "Dictational Generate",
                                "success": False,
                                "error": "Files array is empty"
                            })
                            return False
                    else:
                        print(f"❌ Failed - Missing files or summary in completion data")
                        self.test_results.append({
                            "name": "Dictational Generate",
                            "success": False,
                            "error": "Missing files or summary"
                        })
                        return False
                else:
                    print(f"❌ Failed - No completion data received")
                    self.test_results.append({
                        "name": "Dictational Generate",
                        "success": False,
                        "error": "No completion data"
                    })
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({
                    "name": "Dictational Generate",
                    "success": False,
                    "status_code": response.status_code,
                    "response": response.text[:200]
                })
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            import traceback
            print(f"   Traceback: {traceback.format_exc()}")
            self.test_results.append({
                "name": "Dictational Generate",
                "success": False,
                "error": str(e)
            })
            return False

def main():
    print("🚀 Starting Whisp API Testing...")
    print("=" * 50)
    
    tester = WhispAPITester()
    
    # Test basic API functionality
    tester.test_root_endpoint()
    
    # Test project management
    project_id = tester.test_create_project()
    tester.test_get_projects()
    tester.test_get_project(project_id)
    
    # Test conversation management
    conversation_id = tester.test_create_conversation()
    
    # Test code generation
    tester.test_generate_code()
    
    # Test OpenAI Realtime API endpoints
    tester.test_realtime_session()
    tester.test_realtime_negotiate()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        print("\nFailed tests:")
        for result in tester.test_results:
            if not result.get('success', False):
                print(f"  - {result['name']}: {result.get('error', 'Status code mismatch')}")
        return 1

if __name__ == "__main__":
    sys.exit(main())