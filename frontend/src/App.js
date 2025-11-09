import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import LandingPage from "@/pages/LandingPage";
import EditorPage from "@/pages/EditorPage";
import DictationalPage from "@/pages/DictationalPage";
import DictationalEditor from "@/pages/DictationalEditor";
import ConversationalEditor from "@/pages/ConversationalEditor";
import FeaturesPage from "@/pages/FeaturesPage";
import { ThemeProvider } from "@/contexts/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/workspace" element={<LandingPage />} />
            <Route path="/dictational" element={<DictationalPage />} />
            <Route path="/dictational-editor" element={<DictationalEditor />} />
            <Route path="/conversational-editor" element={<ConversationalEditor />} />
            <Route path="/editor" element={<EditorPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;