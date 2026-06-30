import { NavLink, Route, Routes } from "react-router-dom";
import { open } from "@tauri-apps/plugin-shell";
import { AuthProvider, useAuth } from "./lib/auth";
import { getMicrosoftLoginUrl } from "./lib/api";
import Home from "./pages/Home";
import Mods from "./pages/Mods";
import Servers from "./pages/Servers";
import Cosmetics from "./pages/Cosmetics";
import Friends from "./pages/Friends";
import News from "./pages/News";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/mods", label: "Mods" },
  { to: "/servers", label: "Servers" },
  { to: "/cosmetics", label: "Cosmetics" },
  { to: "/friends", label: "Friends" },
  { to: "/news", label: "News" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-6 px-2 text-lg font-bold tracking-wide text-violet-400">
        Pulsar Client
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function TopBar() {
  const { user, loading } = useAuth();

  const handleLogin = async () => {
    await open(getMicrosoftLoginUrl());
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-zinc-800 bg-zinc-950 px-6">
      {loading ? (
        <span className="text-sm text-zinc-500">Checking session...</span>
      ) : user ? (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold uppercase text-white">
            {user.username.slice(0, 1)}
          </div>
          <span className="text-sm font-medium text-zinc-200">{user.username}</span>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Login with Microsoft
        </button>
      )}
    </header>
  );
}

function Shell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mods" element={<Mods />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/cosmetics" element={<Cosmetics />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/news" element={<News />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
