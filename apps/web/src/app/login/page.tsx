"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: regSettings } = useQuery({
    queryKey: ["registration-settings"],
    queryFn: () => apiClient.get("/auth/registration-settings").then((r) => r.data.data),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: () => apiClient.post("/auth/login", { email, password }).then((r) => r.data.data),
    onSuccess: () => router.push("/drive"),
  });

  const registerMutation = useMutation({
    mutationFn: () => apiClient.post("/auth/register", { email, password }).then((r) => r.data.data),
    onSuccess: () => router.push("/drive"),
  });

  const showRegister = regSettings?.registrationEnabled !== false;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">TDrive</CardTitle>
          <CardDescription>Telegram-powered cloud storage</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: showRegister ? "1fr 1fr" : "1fr" }}>
              <TabsTrigger value="login">Sign In</TabsTrigger>
              {showRegister && <TabsTrigger value="register">Register</TabsTrigger>}
            </TabsList>
            <TabsContent value="login">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate();
                }}
                className="space-y-4 mt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {loginMutation.isError && (
                  <p className="text-sm text-destructive">Login failed. Check your credentials.</p>
                )}
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            {showRegister && (
              <TabsContent value="register">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    registerMutation.mutate();
                  }}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  {registerMutation.isError && (
                    <p className="text-sm text-destructive">Registration failed.</p>
                  )}
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Register
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
