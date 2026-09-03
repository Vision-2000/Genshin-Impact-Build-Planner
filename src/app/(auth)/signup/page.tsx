import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Genshin Build Tracker</h1>
      <SignupForm />
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
