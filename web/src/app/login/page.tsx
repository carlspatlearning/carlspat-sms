"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { homePathFor, saveSession, SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";

interface School {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [school, setSchool] = useState<School | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<School>>("/settings/school").then((r) => setSchool(r.data)).catch(() => null);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<{ user: SessionUser; accessToken: string; refreshToken: string }>>(
        "/auth/login",
        { email, password }
      );
      saveSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.push(params.get("next") ?? homePathFor(res.data.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-6 text-center">
        {school?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logoUrl} alt="School logo" className="mx-auto h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <GraduationCap className="h-8 w-8" />
          </div>
        )}
        <h1 className="mt-3 text-2xl font-bold">{school?.name ?? "Carlspat Private School"}</h1>
        <p className="text-sm italic text-muted-foreground">
          “{school?.motto ?? "Emphasis on All-Round Development"}”
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to your portal</CardTitle>
          <CardDescription>Admin · Teacher · Parent · Student · Bursar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@carlspat.sch.ng"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {school && (
        <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
          {school.address} · {school.phone} · {school.email}
        </p>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
