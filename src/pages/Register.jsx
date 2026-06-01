import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import khonoImage from "@/assets/images/khono.png";

export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked, checkUserAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [authChecked, isAuthenticated, navigate]);

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const trimmedConfirm = confirmPassword.trim();
  const isFormComplete = Boolean(trimmedEmail && trimmedPassword && trimmedConfirm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trimmedEmail || !trimmedPassword || !trimmedConfirm) {
      setError("Please fill in all required fields.");
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // @ts-ignore
      await base44.auth.register({ email: trimmedEmail, password: trimmedPassword, fullName: "", phone: "" });
      await checkUserAuth();
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthLayout
        icon={null}
        topImage={khonoImage}
        topImageAlt="Khonofy"
        topImageClassName="w-72 sm:w-80"
        title="Create account"
        subtitle="Sign up to get started"
        titleInCard
        titleClassName="text-lg sm:text-xl font-semibold"
        subtitleClassName="text-xs"
        afterCard={null}
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Log in
            </Link>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

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
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-full"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 rounded-full"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-full font-medium" disabled={loading || !isFormComplete}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "CREATE ACCOUNT"
            )}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <button
            type="button"
            // @ts-ignore
            onClick={() => base44.auth.loginWithProvider('microsoft', '/')}
            className="w-full h-12 rounded-full border border-slate-200 bg-white hover:shadow-md transition-shadow flex items-center justify-center gap-3 font-medium text-slate-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Continue with Microsoft
          </button>
        </form>
      </AuthLayout>
    </>
  );
}