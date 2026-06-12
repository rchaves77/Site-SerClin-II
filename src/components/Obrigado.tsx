import { CheckCircle2, ArrowLeft, MessageCircle } from "lucide-react";

interface ObrigadoProps {
  setView: (view: string) => void;
}

export default function Obrigado({ setView }: ObrigadoProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        
        {/* Ícone de Sucesso */}
        <div className="flex justify-center">
          <div className="bg-emerald-100 p-4 rounded-full">
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
          </div>
        </div>
        
        {/* Texto Principal */}
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-bold text-[#005183]">
            Recebemos seu contato!
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed">
            Obrigado por escolher o Instituto SerClin. Nossa equipe entrará em contato via WhatsApp em breve.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-4">
          <a 
            href="https://wa.me/5568992161717" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-[#005183] hover:bg-[#003d63] text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" /> 
            Falar no WhatsApp agora
          </a>
          
          <button 
            onClick={() => setView("home")}
            className="w-full bg-white border border-slate-200 text-slate-600 font-semibold h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" /> 
            Voltar para o site
          </button>
        </div>

        {/* Rodapé institucional */}
        <p className="text-xs text-slate-400 pt-8 font-medium uppercase tracking-widest">
          Instituto SerClin — Atendimento Humanizado e Especializado
        </p>
      </div>
    </div>
  );
}
