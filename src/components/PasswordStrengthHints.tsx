"use client";

import { getPasswordRules, passwordStrength } from "@/lib/passwordPolicy";

export default function PasswordStrengthHints({ password }: { password: string }) {
  const rules = getPasswordRules(password);
  const strength = passwordStrength(password);

  return (
    <div className="space-y-2">
      {password.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-medium text-zinc-400">
            <span>Fuerza de la contraseña:</span>
            <span className="font-bold text-white">{strength.label}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${strength.color} transition-all duration-300`}
              style={{ width: `${(strength.passed / 4) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 bg-[#111726]/60 p-2.5 space-y-1 text-[11px]">
        <div className={`flex items-center gap-2 ${rules.minLength ? "text-gold font-bold" : "text-zinc-500"}`}>
          <span>{rules.minLength ? "✓" : "•"}</span> Mínimo 8 caracteres
        </div>
        <div className={`flex items-center gap-2 ${rules.hasUpperLower ? "text-gold font-bold" : "text-zinc-500"}`}>
          <span>{rules.hasUpperLower ? "✓" : "•"}</span> Mayúsculas y minúsculas (a-Z)
        </div>
        <div className={`flex items-center gap-2 ${rules.hasNumber ? "text-gold font-bold" : "text-zinc-500"}`}>
          <span>{rules.hasNumber ? "✓" : "•"}</span> Al menos un número (0-9)
        </div>
        <div className={`flex items-center gap-2 ${rules.hasSymbol ? "text-gold font-bold" : "text-zinc-500"}`}>
          <span>{rules.hasSymbol ? "✓" : "•"}</span> Al menos un símbolo (!@#$%^&*)
        </div>
      </div>
    </div>
  );
}
