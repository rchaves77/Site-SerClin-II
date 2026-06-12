import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, CheckCircle2, RefreshCw } from "lucide-react";

interface RedefinirSenhaProps {
  setView: (view: string) => void;
}

export function RedefinirSenha({ setView }: RedefinirSenhaProps) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 6) {
      return toast.warning("A senha deve ter pelo menos 6 caracteres.");
    }

    if (novaSenha !== confirmarSenha) {
      return toast.error("As senhas não coincidem.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (error) throw error;

      toast.success("Senha atualizada com sucesso!");
      setTimeout(() => setView('login'), 2000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-8">
        
        {/* LOGO E TÍTULO */}
        <div className="text-center space-y-4">
          <div className="mx-auto bg-blue-50 w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner border border-blue-100">
            <Lock className="w-10 h-10 text-[#1e3a8a]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1e3a8a] uppercase tracking-tight">Nova Senha</h1>
            <p className="text-sm text-gray-500 font-medium italic">Instituto SerClin - Segurança Integrada</p>
          </div>
        </div>

        {/* CARD DO FORMULÁRIO */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#1e3a8a]"></div>
          
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-4 text-left">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Digite a nova senha</label>
                <div className="relative">
                  <Input 
                    type={mostrarSenha ? "text" : "password"} 
                    value={novaSenha} 
                    onChange={e => setNovaSenha(e.target.value)} 
                    placeholder="Mínimo 6 dígitos" 
                    className="h-12 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]" 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setMostrarSenha(!mostrarSenha)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1e3a8a] cursor-pointer"
                  >
                    {mostrarSenha ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Confirme a nova senha</label>
                <div className="relative">
                  <Input 
                    type={mostrarSenha ? "text" : "password"} 
                    value={confirmarSenha} 
                    onChange={e => setConfirmarSenha(e.target.value)} 
                    placeholder="Repita a senha" 
                    className="h-12 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1e3a8a]" 
                    required 
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200" size={18} />
                </div>
              </div>

            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#1e3a8a] hover:bg-black text-white font-black h-14 rounded-2xl shadow-xl uppercase text-xs tracking-widest transition-all gap-2 cursor-pointer"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={18} />}
              {loading ? "Atualizando..." : "Confirmar Nova Senha"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
          Proteja seus dados. Nunca compartilhe sua senha.
        </p>
      </div>
    </div>
  );
}
