import Logo from "../../components/Logo";
import RegisterForm from "./RegisterForm";

export default function RegisterPage(){
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-md">
        <Logo/>
        <div className="card mt-10 p-7">
          <h1 className="text-2xl font-black">Tạo tài khoản</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tham gia cộng đồng mua bán Phú Thọ.
          </p>
          <RegisterForm/>
        </div>
      </div>
    </main>
  );
}