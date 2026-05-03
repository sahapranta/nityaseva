import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

// Types
export interface AuthUser {
  id: number;
  name: string;
  mobile: string | null;
  role: "super_admin" | "admin" | "operator";
  status: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Pin Pad with Keyboard Support ────────────────────────────────────
function PinPad({ onComplete }: { onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState("");

  const press = (digit: string) => {
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) {
        // Short delay for visual feedback of the last dot filling
        setTimeout(() => {
          onComplete(next);
          setPin("");
        }, 150);
      }
      return next;
    });
  };

  const del = () => setPin((p) => p.slice(0, -1));

  // Keyboard Binding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        press(e.key);
      } else if (e.key === "Backspace") {
        del();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin]); // Re-bind to ensure closure has current pin length check

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Dots */}
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? "bg-saffron-600 border-saffron-600 scale-110"
                : "bg-slate-100 border-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k, i) => {
          if (k === "") return <div key={i} />;
          return (
            <button
              key={i}
              onClick={() => (k === "⌫" ? del() : press(k))}
              className={`w-16 h-14 flex items-center justify-center rounded-xl text-lg font-bold transition-all active:scale-95 ${
                k === "⌫"
                  ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  : "bg-white border border-slate-200 text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50"
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePin = async (pin: string) => {
    setLoading(true);
    setError("");
    try {
      const user = await invoke<AuthUser>("verify_pin", { passcode: pin });
      onLogin(user);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="" subtitle="Enter your 6-digit PIN to continue">
      <PinPad onComplete={handlePin} />
      <div className="h-6 mt-4 text-center">
        {loading && <p className="text-xs text-slate-400 animate-pulse">Verifying...</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      </div>
    </AuthShell>
  );
}

// ── Setup Wizard
function SetupWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"info" | "pin" | "confirm">("info");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleInfo = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    setStep("pin");
  };

  const handlePin = (p: string) => {
    setPin(p);
    setStep("confirm");
  };

  const handleConfirm = async (p: string) => {
    if (p !== pin) {
      setError("PINs do not match. Try again.");
      setStep("pin");
      setPin("");
      return;
    }
    setError("");
    try {
      await invoke("create_super_admin", {
        name: name.trim(),
        mobile: mobile.trim() || null,
        passcode: p,
      });
      onDone();
    } catch (e) {
      setError(String(e));
      setStep("pin");
    }
  };

  return (
    <AuthShell title="Setup Nityaseva" subtitle="Create the super-admin account">
      {step === "info" && (
        <form onSubmit={handleInfo} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name *</label>
            <input 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Your name" 
              autoFocus 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile (optional)</label>
            <input 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" 
              value={mobile} 
              onChange={e => setMobile(e.target.value)} 
              placeholder="01XXXXXXXXX" 
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-md shadow-orange-200 transition-all active:scale-[0.98]">
            Continue →
          </button>
        </form>
      )}

      {(step === "pin" || step === "confirm") && (
        <div className="flex flex-col gap-4 items-center">
          <p className="text-sm text-slate-600 text-center">
            {step === "pin" ? <>Set PIN for <span className="font-bold text-slate-800">{name}</span></> : "Confirm your PIN"}
          </p>
          <PinPad onComplete={step === "pin" ? handlePin : handleConfirm} />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </AuthShell>
  );
}

// ── Auth Shell (centered card) ───────────────────────────────────────
function AuthShell({ title, subtitle, children }: {
  title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* <div className="w-14 h-14 bg-orange-600  flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4 shadow-lg shadow-orange-200">
            ন
          </div> */}
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt="Nityaseva Logo" className="w-34 shadow-2xl rounded-full"/>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">নিত্যসেবা বিভাগ</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Membership Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="px-6 pt-4">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
              <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Provider ────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState<"checking" | "setup" | "login" | "done">("checking");

  useEffect(() => {
    invoke<boolean>("has_users")
      .then((has) => setReady(has ? "login" : "setup"))
      .catch(() => setReady("login"));
  }, []);

  if (ready === "checking") {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400 font-medium animate-pulse">
        Initializing...
      </div>
    );
  }

  if (ready === "setup") {
    return <SetupWizard onDone={() => setReady("login")} />;
  }

  if (ready === "login" || !user) {
    return (
      <AuthContext.Provider value={{ user, login: setUser, logout: () => setUser(null) }}>
        <LoginScreen onLogin={(u) => { setUser(u); setReady("done"); }} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login: setUser, logout: () => { setUser(null); setReady("login"); } }}>
      {children}
    </AuthContext.Provider>
  );
}