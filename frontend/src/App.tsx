import { Navigate, Route, Routes } from "react-router-dom";
import { AppRedirect } from "./components/AppRedirect";
import { ScriptStudio } from "./pages/ScriptStudio";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppRedirect />} />
      <Route path="/app/:id" element={<ScriptStudio />} />
    </Routes>
  );
}

export default App;
