import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// No StrictMode: its doubled effects would spend the one-time sign-in token
// twice and open a second socket.
createRoot(document.getElementById("root")!).render(<App />);
