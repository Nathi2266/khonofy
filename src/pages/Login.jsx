import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Eye, EyeOff, Loader2, Github } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import khonoImage from "@/assets/images/khono.png";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked, checkUserAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [authChecked, isAuthenticated, navigate]);

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const isFormComplete = Boolean(trimmedEmail && trimmedPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trimmedEmail || !trimmedPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(trimmedEmail, trimmedPassword);
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const errorBanner = error ? (
    <div className="bg-[#5a0000] px-6 py-4 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-wide">Incorrect Login Credentials.</p>
      <p className="text-xs mt-1">Kindly ensure inputs are correct and re-attempt.</p>
    </div>
  ) : null;

  return (
    <>
      <AuthLayout
        icon={null}
        topImage={khonoImage}
        topImageAlt="Khonofy"
        topImageClassName="w-42 sm:w-48"
        title="KHONOFY"
        subtitle="Smart time tracking, task management & reporting platform for teams"
        titleInCard
        afterCard={errorBanner}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-full"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-full pl-4 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-full font-medium bg-primary hover:bg-primary/90 text-white" disabled={loading || !isFormComplete}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "LOGIN"
            )}
          </Button>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button type="button" className="h-11 w-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center" aria-label="Continue with Google">
              <GoogleIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => base44.auth.loginWithProvider(
// @ts-ignore
            'microsoft', '/')} className="h-11 w-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow" aria-label="Continue with Microsoft">
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
            </button>
            <button type="button" className="h-11 w-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center" aria-label="Continue with GitHub">
              <Github className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              type="button"
              className="h-12 rounded-full bg-[#7a7a7a] hover:bg-[#6b6b6b] text-white font-semibold uppercase"
              onClick={() => navigate(-1)}
            >
              BACK
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full bg-transparent border border-foreground/30 text-foreground font-semibold uppercase hover:bg-muted/40"
              onClick={() => navigate("/forgot-password")}
            >
              FORGOT PASSWORD
            </Button>
          </div>
        </form>
      </AuthLayout>
    </>
  );
}