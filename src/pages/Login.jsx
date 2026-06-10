import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import khonoImage from "@/assets/images/khono.png";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked, checkUserAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sentryTestMessage, setSentryTestMessage] = useState("");
  const [sentryTestLoading, setSentryTestLoading] = useState(false);
  const [backendSentryTestLoading, setBackendSentryTestLoading] = useState(false);

  // @ts-ignore
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [authChecked, isAuthenticated, navigate]);

  useEffect(() => {
    const isTypingKey = (event) => {
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return true;
      }
      return event.key === "Backspace" || event.key === "Delete";
    };

    const handleKeyDown = (event) => {
      const target = event.target;
      const isEmailOrPassword =
        target instanceof HTMLInputElement &&
        (target.id === "email" || target.id === "password");

      if (!isEmailOrPassword && isTypingKey(event)) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const trimmedEmail = email.trim();
  const passwordValue = password;
  const isFormComplete = Boolean(trimmedEmail && passwordValue);

  const handleBackendSentryTest = async () => {
    setSentryTestMessage("");
    setBackendSentryTestLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/debug/sentry-test`);
      if (!response.ok) {
        setSentryTestMessage(
          "Backend test error sent. Check your backend Sentry project for the connectivity test."
        );
        return;
      }
      setSentryTestMessage("Backend responded without an error. Sentry test may not have fired.");
    } catch {
      setSentryTestMessage("Could not reach the backend Sentry test endpoint.");
    } finally {
      setBackendSentryTestLoading(false);
    }
  };

  const handleSentryTest = async () => {
    setSentryTestMessage("");
    setSentryTestLoading(true);
    try {
      if (!Sentry.getClient()) {
        setSentryTestMessage(
          "Sentry is not connected. Restart the dev server after adding VITE_SENTRY_DSN to .env.local, or test on the deployed site."
        );
        return;
      }

      const eventId = Sentry.captureException(
        new Error("Khonofy login page Sentry connectivity test"),
        {
          tags: { source: "login-page", test: "true" },
          level: "info",
        }
      );
      await Sentry.flush(2000);
      setSentryTestMessage(
        eventId
          ? `Test error sent to Sentry (event ${eventId}). Check the khonofy-frontend project.`
          : "Test error sent to Sentry. Check the khonofy-frontend project."
      );
    } catch {
      setSentryTestMessage("Failed to send test error to Sentry.");
    } finally {
      setSentryTestLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!trimmedEmail || !passwordValue) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(trimmedEmail, passwordValue);
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
      <p className="text-sm font-semibold uppercase tracking-wide">{error}</p>
    </div>
  ) : null;

  return (
    <>
      <AuthLayout
        icon={null}
        topImage={khonoImage}
        topImageAlt="Khonology - Khonofy"
        topImageClassName="w-[22.05rem] sm:w-[25.2rem]"
        title="KHONOFY"
        subtitle="Smart time tracking, task management & reporting platform for teams"
        titleInCard
        compact
        afterCard={errorBanner}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          onMouseDown={(event) => {
            const target = event.target;
            const element = target instanceof Element ? target : null;
            const isInteractive =
              target instanceof HTMLInputElement ||
              target instanceof HTMLButtonElement ||
              target instanceof HTMLLabelElement ||
              element?.closest("button") ||
              element?.closest("label");

            if (!isInteractive) {
              event.preventDefault();
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@khonology.com"
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
                placeholder="password123#"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-full pl-4 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-full font-medium bg-primary hover:bg-primary/90 text-white" disabled={loading || !isFormComplete}>
            {loading ? "Logging in..." : "LOGIN"}
          </Button>
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={handleSentryTest}
                disabled={sentryTestLoading || backendSentryTestLoading}
              >
                {sentryTestLoading ? "Sending..." : "Test Frontend"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={handleBackendSentryTest}
                disabled={sentryTestLoading || backendSentryTestLoading}
              >
                {backendSentryTestLoading ? "Sending..." : "Test Backend"}
              </Button>
            </div>
            {sentryTestMessage ? (
              <p className="text-center text-[11px] text-muted-foreground">{sentryTestMessage}</p>
            ) : (
              <p className="text-center text-[11px] text-muted-foreground">
                Send test errors to Sentry from the frontend or backend.
              </p>
            )}
          </div>
        </form>
      </AuthLayout>
    </>
  );
}