import { useState } from "react";
import "./App.css";
import DashboardDemo from "./components/DashboardDemo";

function App() {
  const [activeTab, setActiveTab] = useState<"demo" | "widgets" | "api">(
    "demo"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Open Dashboard
              </h1>
              <p className="text-gray-600">
                Modular, extensible dashboard system
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("demo")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "demo"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Dashboard Demo
              </button>
              <button
                onClick={() => setActiveTab("widgets")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "widgets"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Widget Gallery
              </button>
              <button
                onClick={() => setActiveTab("api")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "api"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                API Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === "demo" && <DashboardDemo />}
        {activeTab === "widgets" && (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-4">Widget Gallery</h2>
            <p className="text-gray-600">
              Coming soon - showcase of all available widgets
            </p>
          </div>
        )}
        {activeTab === "api" && (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-4">API Integration Demo</h2>
            <p className="text-gray-600">
              Coming soon - live API data integration examples
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
