"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const normalizedName = name.trim();

    if (normalizedName.length < 2) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (normalizedPhone && !/^(0|\+84)[0-9 .-]{8,14}$/.test(normalizedPhone)) {
      setError("Số điện thoại chưa đúng định dạng.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== password2) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: normalizedName, phone: normalizedPhone },
        },
      });

      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        setError(
          message.includes("already registered") ||
          message.includes("already been registered")
            ? "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác."
            : signUpError.message
        );
        return;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      const { data: loginData, error: loginError } =
        await supabaseBrowser.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginData.session && !loginError) {
        router.replace("/");
        router.refresh();
        return;
      }

      const message = loginError?.message.toLowerCase() ?? "";
      if (
        message.includes("email not confirmed") ||
        message.includes("email not verified")
      ) {
        setError(
          "Tài khoản đã tạo nhưng Supabase đang yêu cầu xác nhận email. Hãy tắt 'Confirm email' trong Supabase Auth nếu muốn khách đăng ký xong vào web ngay."
        );
      } else {
        setError(
          "Đăng ký thành công nhưng chưa thể tự đăng nhập. Vui lòng thử đăng nhập lại."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input required value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Họ và tên" autoComplete="name"
        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="Số điện thoại (không bắt buộc)" inputMode="tel" autoComplete="tel"
        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email" autoComplete="email"
        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500" />
      <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu (tối thiểu 6 ký tự)" autoComplete="new-password"
        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500" />
      <input required minLength={6} type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
        placeholder="Nhập lại mật khẩu" autoComplete="new-password"
        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500" />

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-600">
          <p>{error}</p>
          {error.includes("Confirm email") && (
            <Link href="/dang-nhap" className="mt-2 inline-block font-bold text-brand-700">
              Đi tới đăng nhập →
            </Link>
          )}
        </div>
      )}

      <button disabled={loading}
        className="w-full rounded-xl bg-brand-600 py-3 font-extrabold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? "Đang tạo tài khoản..." : "Đăng ký & vào web"}
      </button>

      <p className="pt-2 text-center text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link href="/dang-nhap" className="font-bold text-brand-700">Đăng nhập</Link>
      </p>
    </form>
  );
}
