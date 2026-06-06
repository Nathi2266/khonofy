import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock } from "lucide-react";
import DiscLoader from "@/components/DiscLoader";
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
        topImageAlt="Khonology - Khonofy"
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
                <DiscLoader size="sm" className="mr-2 gap-1.5" label="Creating account" />
                Creating account...
              </>
            ) : (
              "CREATE ACCOUNT"
            )}
          </Button>

        </form>
      </AuthLayout>
    </>
  );
}