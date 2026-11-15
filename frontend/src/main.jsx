import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles.css";
import "./styles-learn.css";
import "./styles-polish.css";
import "./styles-fixes.css";
import { AtlasProvider, useAtlas } from "./store";
import { Footer, Header, Intro, Toast, Tour } from "./components/Chrome";
import ViewerPage from "./pages/ViewerPage";
import AnalysisPage from "./pages/AnalysisPage";
import DataPage from "./pages/DataPage";
import GalleryPage from "./pages/GalleryPage";
import AboutPage from "./pages/AboutPage";
import LearnPage from "./pages/LearnPage";

const PAGES = { "/": ViewerPage, "/analysis": AnalysisPage, "/data": DataPage, "/learn": LearnPage, "/gallery": GalleryPage, "/about": AboutPage };
const TITLES = { "/": "Viewer", "/analysis": "Analysis", "/data": "Data", "/learn": "Learning Hub", "/gallery": "Gallery", "/about": "About" };

function App() {
  const { route, s } = useAtlas();
  const Page = PAGES[route] || ViewerPage;
  React.useEffect(() => {
    document.title = `${s.name ? s.name + " · " : ""}${TITLES[route] || "Viewer"} · OpenAtlas`;
  }, [route, s.name]);
  return (
    <div className="oa">
      <a className="skip" href="#content" onClick={(e) => { e.preventDefault(); document.getElementById("content")?.focus(); }}>Skip to content</a>
      <Header />
      <div id="content" tabIndex={-1} className="content" key={route}><Page /></div>
      <Footer />
      <Toast />
      <Tour />
      <Intro />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AtlasProvider>
      <App />
    </AtlasProvider>
  </React.StrictMode>,
);
