import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap — MTA Vardiya ve Yoklama",
  description: "Kimlik numarası ve şifrenizle giriş yaparak vardiya takvimini ve yoklama durumunu takip edin.",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      {/* Full-width banner */}
      <div style={{ width: "100%", lineHeight: 0 }}>
        <Image
          src="/mtabanner.png"
          alt="MTA Banner"
          width={1920}
          height={400}
          priority
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
        />
      </div>

      {/* Centered login form */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--sp-8) var(--sp-4)",
        }}
      >
        <div className="login-box">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
