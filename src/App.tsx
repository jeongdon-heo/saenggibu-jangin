import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { DataProvider } from "./context/DataContext";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { ClassPage } from "./pages/ClassPage";
import { FormsPage } from "./pages/FormsPage";
import { HomePage } from "./pages/HomePage";
import { NeisPage } from "./pages/NeisPage";
import { ObservePage } from "./pages/ObservePage";
import { QuestionsPage } from "./pages/QuestionsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SelectPage } from "./pages/SelectPage";
import { SurveyPage } from "./pages/SurveyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage, StepPage } from "./pages/StepPage";
import { SubjectsPage } from "./pages/SubjectsPage";
import { TeachPage } from "./pages/TeachPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/class" element={<ClassPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/teach" element={<TeachPage />} />
              <Route path="/questions" element={<QuestionsPage />} />
              <Route path="/select" element={<SelectPage />} />
              <Route path="/forms" element={<FormsPage />} />
              <Route path="/survey" element={<SurveyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/observe" element={<ObservePage />} />
              <Route path="/neis" element={<NeisPage />} />
              <Route path="/steps/:stepId" element={<StepPage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </HashRouter>
    </DataProvider>
  );
}
