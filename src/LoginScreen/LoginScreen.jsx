import { useMemo, useState } from "react";
import "./LoginScreen.css";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../services/api";
import {
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [fpOpen,    setFpOpen]    = useState(false);
  const [fpStep,    setFpStep]    = useState(1);
  const [fpEmail,   setFpEmail]   = useState("");
  const [fpOtp,     setFpOtp]     = useState("");
  const [fpPass,    setFpPass]    = useState("");
  const [fpPass2,   setFpPass2]   = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg,     setFpMsg]     = useState("");
  const [fpErr,     setFpErr]     = useState("");

  const openFp = () => { setFpOpen(true); setFpStep(1); setFpEmail(""); setFpOtp(""); setFpPass(""); setFpPass2(""); setFpMsg(""); setFpErr(""); };
  const closeFp = () => setFpOpen(false);

  const fpHandleError = (e) => {
    const status = e?.response?.status;
    if (!e?.response && e?.message === "Network Error") return "Unable to connect to server.";
    if (status === 429) return "Too many attempts. Please wait a few minutes.";
    return e?.response?.data?.message || e?.message;
  };

  const fpSendOtp = async () => {
    if (!fpEmail.trim()) return setFpErr("Enter your email address");
    if (!EMAIL_REGEX.test(fpEmail.trim())) return setFpErr("Please enter a valid email address");
    setFpLoading(true); setFpErr("");
    try {
      const r = await fetch(`${API}/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fpEmail.trim() }) });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      setFpMsg(j.message);
      setFpStep(2);
    } catch (e) { setFpErr(fpHandleError(e) || "Failed to send OTP"); }
    finally { setFpLoading(false); }
  };

  const fpVerifyOtp = async () => {
    if (fpOtp.trim().length !== 6) return setFpErr("Enter the 6-digit OTP");
    setFpLoading(true); setFpErr("");
    try {
      const r = await fetch(`${API}/api/auth/verify-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fpEmail.trim(), otp: fpOtp.trim() }) });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      setFpStep(3);
    } catch (e) { setFpErr(fpHandleError(e) || "Invalid OTP"); }
    finally { setFpLoading(false); }
  };

  const fpResetPass = async () => {
    if (fpPass.trim().length < 6) return setFpErr("Password must be at least 6 characters");
    if (fpPass !== fpPass2) return setFpErr("Passwords do not match");
    setFpLoading(true); setFpErr("");
    try {
      const r = await fetch(`${API}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fpEmail.trim(), otp: fpOtp.trim(), newPassword: fpPass.trim() }) });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      setFpStep(4);
    } catch (e) { setFpErr(fpHandleError(e) || "Failed to reset password"); }
    finally { setFpLoading(false); }
  };

  const highlights = useMemo(() => [
    { text: "Track every lead from first contact to project delivery" },
    { text: "Manage enquiries across Bangalore, Mumbai & Mysore" },
    { text: "Instant visibility into your team's pipeline and performance" },
  ], []);

  const onSubmit = async (e) => {
    try {
      e.preventDefault();
      setErrorMessage("");
      setLoading(true);

      if (!email?.trim() || !password?.trim()) {
        setErrorMessage("Email and password are required");
        return;
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        setErrorMessage("Please enter a valid email address");
        return;
      }

      const response = await loginAdmin({ email: email.trim(), password: password.trim() });
      const result = response?.data;

      if (!result?.success) throw new Error(result?.message || "Login failed");

      const token = result?.data?.token;
      const user = result?.data?.user;

      if (!token || !user) throw new Error("Invalid login response from server");

      localStorage.setItem("nnc_auth", "true");
      localStorage.setItem("nnc_token", token);
      localStorage.setItem("nnc_role", user.role || "");
      localStorage.setItem("nnc_email", user.email || "");
      localStorage.setItem("nnc_user", JSON.stringify(user));
      if (user.modules != null) {
        localStorage.setItem("nnc_modules", JSON.stringify(user.modules));
      } else {
        localStorage.removeItem("nnc_modules");
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      const status = err?.response?.status;
      if (!err?.response && err?.message === "Network Error") {
        setErrorMessage("Unable to connect to server. Please check your internet connection and try again.");
      } else if (status === 401) {
        setErrorMessage("Invalid email or password. Please check your credentials.");
      } else if (status === 403) {
        setErrorMessage("Access denied. Your account may be disabled.");
      } else if (status === 429) {
        setErrorMessage("Too many login attempts. Please wait a few minutes before trying again.");
      } else {
        setErrorMessage(err?.response?.data?.message || err?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginPage">
      {/* Full-page background */}
      <div className="loginBgImg" />
      <div className="loginBgOverlay" />

      {/* Left — hero content over image */}
      <div className="loginLeft">

        <div className="lHero">
          <h1 className="lHeroTitle">
            Every enquiry<br />
            matters. Every<br />
            project delivered.
          </h1>
          <p className="lHeroDesc">
            NNC&apos;s complete CRM for managing website development enquiries
            across Bangalore, Mumbai &amp; Mysore — from first contact to project delivery.
          </p>
        </div>

        <div className="lHighlights">
          {highlights.map((h, i) => (
            <div key={i} className="lHighlightItem">
              <span className="lHighlightDot" />
              <span>{h.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — white panel */}
      <div className="loginRight">
        <div className="lrInner">
          <img src="/nnclogo.png" alt="NNC Logo" className="lrLogo" />
          <div className="lrWelcome">Welcome to NNC CRM</div>
          <h2 className="lrTitle">Sign in to your<br />workspace</h2>

          <form className="lrForm" onSubmit={onSubmit}>
            <div className="lrField">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="lrField">
              <div className="lrFieldHeader">
                <label>Password</label>
                <button type="button" className="lrForgot" onClick={openFp}>Forgot password?</button>
              </div>
              <div className="lrPasswordWrap">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="lrEyeBtn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="lrError">{errorMessage}</div>
            )}

            <button className="lrSubmitBtn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In to NNC CRM"}
            </button>
          </form>

          <div className="lrFooter">
            Use your admin credentials to continue
            <div className="lrCopy">© 2026 NNC Website Services • All rights reserved</div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {fpOpen && (
        <div className="fpOverlay" onClick={closeFp}>
          <div className="fpModal" onClick={e => e.stopPropagation()}>
            <div className="fpHeader">
              {fpStep > 1 && fpStep < 4 && (
                <button className="fpBack" onClick={() => { setFpStep(s => s - 1); setFpErr(""); }}>
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="fpHeaderText">
                <div className="fpTitle">
                  {fpStep === 1 && "Forgot Password"}
                  {fpStep === 2 && "Enter OTP"}
                  {fpStep === 3 && "New Password"}
                  {fpStep === 4 && "Password Reset!"}
                </div>
                <div className="fpSub">
                  {fpStep === 1 && "We'll send a 6-digit OTP to your registered email"}
                  {fpStep === 2 && `OTP sent to ${fpEmail.trim()}`}
                  {fpStep === 3 && "Choose a strong new password"}
                  {fpStep === 4 && "You can now log in with your new password"}
                </div>
              </div>
              <button className="fpClose" onClick={closeFp}>✕</button>
            </div>

            <div className="fpBody">
              {fpStep === 1 && (
                <>
                  <div className="fpIconWrap"><Mail size={28} color="#2563eb" /></div>
                  <div className="fpField">
                    <label>Your Email Address</label>
                    <input type="email" placeholder="admin@nnc.in" value={fpEmail} onChange={e => { setFpEmail(e.target.value); setFpErr(""); }} />
                  </div>
                  {fpErr && <div className="fpErr">{fpErr}</div>}
                  <button className="fpBtn" onClick={fpSendOtp} disabled={fpLoading}>{fpLoading ? "Sending…" : "Send OTP"}</button>
                </>
              )}
              {fpStep === 2 && (
                <>
                  <div className="fpIconWrap"><ShieldCheck size={28} color="#2563eb" /></div>
                  {fpMsg && <div className="fpSuccess">{fpMsg}</div>}
                  <div className="fpField">
                    <label>6-Digit OTP</label>
                    <input type="text" maxLength={6} placeholder="● ● ● ● ● ●" value={fpOtp} onChange={e => { setFpOtp(e.target.value.replace(/\D/g, "")); setFpErr(""); }} className="fpOtpInput" />
                  </div>
                  {fpErr && <div className="fpErr">{fpErr}</div>}
                  <button className="fpBtn" onClick={fpVerifyOtp} disabled={fpLoading}>{fpLoading ? "Verifying…" : "Verify OTP"}</button>
                  <button className="fpResend" onClick={() => { setFpStep(1); setFpOtp(""); setFpErr(""); }}>Resend OTP</button>
                </>
              )}
              {fpStep === 3 && (
                <>
                  <div className="fpIconWrap"><KeyRound size={28} color="#2563eb" /></div>
                  <div className="fpField">
                    <label>New Password</label>
                    <input type="password" placeholder="Min. 6 characters" value={fpPass} onChange={e => { setFpPass(e.target.value); setFpErr(""); }} />
                  </div>
                  <div className="fpField">
                    <label>Confirm New Password</label>
                    <input type="password" placeholder="Repeat password" value={fpPass2} onChange={e => { setFpPass2(e.target.value); setFpErr(""); }} />
                  </div>
                  {fpErr && <div className="fpErr">{fpErr}</div>}
                  <button className="fpBtn" onClick={fpResetPass} disabled={fpLoading}>{fpLoading ? "Resetting…" : "Reset Password"}</button>
                </>
              )}
              {fpStep === 4 && (
                <div className="fpDone">
                  <CheckCircle2 size={52} color="#16a34a" />
                  <div className="fpDoneTitle">Password Updated!</div>
                  <div className="fpDoneSub">Your password has been reset. Use your new password to sign in.</div>
                  <button className="fpBtn" onClick={closeFp}>Back to Login</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
