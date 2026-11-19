import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { DataProvider } from "./context/DataContext";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { ClassPage } from "./pages/ClassPage";
import { HomePage } from "./pages/HomePage";
import { RecordsPage } from "./pages/RecordsPage";
import { NotFoundPage, StepPage } from "./pages/StepPage";
import { SubjectsPage } from "./pages/SubjectsPage";

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
              <Route path="/records" element={<RecordsPage />} />
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
