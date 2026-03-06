"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function ChangePasswordPage(){

  const router = useRouter();

  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [error,setError] = useState("");

  const handleChange = async () => {

    setError("");

    if(newPassword !== confirmPassword){
      setError("Confirm password does not match");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const res = await fetch("/api/change-password",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        username: user.username,
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();

    if(!res.ok){
      setError(data.error);
      return;
    }

    router.push("/dashboard");
  };

  return(

    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#020617] to-black overflow-hidden">

      {/* background glow */}
      <div className="absolute w-[500px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-full top-[-120px] left-[-120px]" />
      <div className="absolute w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full bottom-[-120px] right-[-120px]" />

      {/* card */}
      <div className="relative w-[420px] p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">

        {/* header */}
        <div className="flex flex-col items-center mb-8">

          <div className="bg-cyan-500/20 p-3 rounded-xl mb-3">
            <Lock className="text-cyan-400 w-6 h-6"/>
          </div>

          <h1 className="text-xl font-bold text-white">
            Change Password
          </h1>

          <p className="text-gray-400 text-sm text-center">
            For security reasons, please update your password
          </p>

        </div>

        {/* current password */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm">
            Current Password
          </label>

          <input
            type="password"
            className="w-full mt-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 transition"
            value={currentPassword}
            onChange={(e)=>setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </div>

        {/* new password */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm">
            New Password
          </label>

          <input
            type="password"
            className="w-full mt-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 transition"
            value={newPassword}
            onChange={(e)=>setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </div>

        {/* confirm password */}
        <div className="mb-5">
          <label className="text-gray-300 text-sm">
            Confirm Password
          </label>

          <input
            type="password"
            className="w-full mt-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 transition"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 text-center">
            {error}
          </p>
        )}

        {/* button */}
        <button
          onClick={handleChange}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold p-2.5 rounded-lg transition"
        >
          Update Password
        </button>

      </div>

    </div>

  );
}