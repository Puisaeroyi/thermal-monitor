"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Thermometer } from "lucide-react";

export default function LoginPage() {

  const router = useRouter();

  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);

  const handleLogin = async () => {

    setError("");
    setLoading(true);

    const res = await fetch("/api/login",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify({username,password})
    });

    const data = await res.json();

    if(!res.ok){
      setError(data.error);
      setLoading(false);
      return;
    }

    localStorage.setItem("user",
      JSON.stringify({
        username:data.username,
        role:data.role
      })
    );

    if(data.firstLogin){
      router.push("/change-password");
    }else{
      router.push("/");   
    }

  };

  return (

    <div className="relative flex h-screen items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#020617] to-black overflow-hidden">

      <div className="absolute w-[500px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-full top-[-100px] left-[-100px]" />
      <div className="absolute w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full bottom-[-100px] right-[-100px]" />

      <div className="relative w-[380px] p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">

        <div className="flex flex-col items-center mb-6">

          <div className="bg-cyan-500/20 p-3 rounded-xl mb-3">
            <Thermometer className="text-cyan-400 w-6 h-6"/>
          </div>

          <h1 className="text-xl font-bold text-white">
            Thermal Monitor
          </h1>

          <p className="text-gray-400 text-sm">
            Monitoring System Dashboard
          </p>

        </div>

        <div className="mb-4">

          <label className="text-gray-300 text-sm">
            Username
          </label>

          <input
            className="w-full mt-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 transition"
            placeholder="Enter username"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
          />

        </div>

        <div className="mb-4">

          <label className="text-gray-300 text-sm">
            Password
          </label>

          <input
            type="password"
            className="w-full mt-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 transition"
            placeholder="Enter password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />

        </div>

        {error && (
          <p className="text-red-400 text-sm mb-3 text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold p-2.5 rounded-lg transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </div>

    </div>

  );
}