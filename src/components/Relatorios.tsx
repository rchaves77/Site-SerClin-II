import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, BarChart3, TrendingUp, CheckCircle, XCircle, 
  Calendar, Download, DollarSign, Filter, AlertCircle, ShieldAlert 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePerfil } from "@/hooks/usePerfil";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface RelatoriosProps {
  setView: (view: string) => void;
}

export function Relatorios({ setView }: RelatoriosProps) {
  const navigate = (path: string) => {
    setView("acessos");
  };

  const { isAdmin } = usePerfil();
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false); 
  
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [stats, setStats] = useState({
    totalAgendados: 0,
    presencas: 0,
    faltas: 0,
    justificadas: 0,
    faturamentoEstimado: 0,
  });

  const carregarRelatorios = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setView("login");
        return;
      }
      
      const { data: perfilLogado } = await supabase.from('perfis').select('permissao_relatorios').eq('email', user.email).single();
      
      if (!perfilLogado?.permissao_relatorios && user.email !== 'romulochaves77@gmail.com') {
        toast.error("Acesso restrito.");
        setView("acessos");
        return;
      }
      
      setAutorizado(true);

      const dataInicio = startOfMonth(new Date(anoSelecionado, mesSelecionado)).toISOString();
      const dataFim = endOfMonth(new Date(anoSelecionado, mesSelecionado)).toISOString();

      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .gte("data_inicio", dataInicio)
        .lte("data_inicio", dataFim);
      
      if (error) throw error;

      if (data) {
        const presencas = data.filter(a => a.status === 'Presenca' || a.status === 'Presença').length;
        const faltas = data.filter(a => a.status === 'Falta').length;
        const justificadas = data.filter(a => a.status === 'Falta Justificada').length;
        const faturamento = presencas * 150; 

        setStats({
          totalAgendados: data.length,
          presencas,
          faltas,
          justificadas,
          faturamentoEstimado: faturamento
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarRelatorios();
  }, [mesSelecionado, anoSelecionado]);

  const calcularPorcentagem = (valor: number) => {
    return stats.totalAgendados > 0 ? (valor / stats.totalAgendados) * 100 : 0;
  };

  const handleExportarPDF = () => {
    window.print();
  };

  const inputClass = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-gray-700 print:hidden";

  if (loading && !autorizado) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-black text-gray-400 uppercase text-xs">Verificando Credenciais...</div>;
  }

  if (!autorizado) return null; 

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-left mt-20">
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          .shadow-md, .shadow-sm { shadow: none !important; border: 1px solid #eee !important; }
        }
      `}</style>

      {/* HEADER MOBILE COM SAFE AREA */}
      <header className="md:hidden bg-white border-b px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] -mx-4 -mt-4 mb-6 sticky top-0 z-40 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sistema")} className="p-2 -ml-2 text-gray-400 cursor-pointer border-none bg-transparent"><ArrowLeft size={24} /></button>
          <div>
            <h1 className="text-sm font-black uppercase text-gray-800 leading-none">Relatórios</h1>
            <p className="text-[9px] font-bold text-blue-600 uppercase mt-1 tracking-widest">Gestão SerClin</p>
          </div>
        </div>
        <Button onClick={handleExportarPDF} size="icon" className="bg-blue-600 text-white rounded-xl shadow-md h-10 w-10 cursor-pointer"><Download size={18} /></Button>
      </header>

      <div className="max-w-6xl mx-auto space-y-8 pb-24">
        
        {/* NAVEGAÇÃO E EXPORTAÇÃO DESKTOP */}
        <div className="hidden md:flex justify-between items-center print:hidden">
          <Button variant="ghost" onClick={() => navigate("/sistema")} className="gap-2 pl-0 hover:bg-transparent hover:text-blue-600 text-gray-600 font-bold uppercase tracking-widest text-xs cursor-pointer">
            <ArrowLeft size={18} /> Voltar ao Painel
          </Button>
          <Button onClick={handleExportarPDF} className="gap-2 bg-blue-600 text-white hover:bg-blue-700 font-black shadow-lg rounded-full px-6 h-12 uppercase tracking-widest text-xs transition-all cursor-pointer">
            <Download size={18} /> Gerar PDF
          </Button>
        </div>

        {/* CABEÇALHO DO RELATÓRIO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-blue-600"></div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter">
              <BarChart3 className="text-blue-600" size={28}/> Visão Geral
            </h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">{format(new Date(anoSelecionado, mesSelecionado), 'MMMM yyyy', { locale: ptBR })}</p>
          </div>
          
          <div className="flex gap-3 items-center print:hidden w-full md:w-auto">
            <select className={`${inputClass} flex-1 md:flex-none h-12 rounded-xl bg-gray-50 border-none uppercase tracking-widest text-xs cursor-pointer`} value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))}>
              {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((mes, i) => (
                <option key={mes} value={i}>{mes}</option>
              ))}
            </select>
            <select className={`${inputClass} w-28 h-12 rounded-xl bg-gray-50 border-none uppercase tracking-widest text-xs cursor-pointer`} value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))}>
              {[2025, 2026].map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>
          </div>
        </div>

        {/* RESUMO FINANCEIRO E PRESENÇA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="border-none shadow-sm bg-white rounded-[1.5rem] md:rounded-[2rem]">
            <CardContent className="p-6 md:p-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Agendado</p>
              <h2 className="text-3xl font-black text-gray-800 mt-2">{stats.totalAgendados}</h2>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
            <CardContent className="p-6 md:p-8 pl-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Presenças</p>
              <h2 className="text-3xl font-black text-green-600 mt-2">{stats.presencas}</h2>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500"></div>
            <CardContent className="p-6 md:p-8 pl-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faltas</p>
              <h2 className="text-3xl font-black text-red-600 mt-2">{stats.faltas}</h2>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-blue-600 rounded-[1.5rem] md:rounded-[2rem]">
            <CardContent className="p-6 md:p-8 text-white">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Faturamento Est.</p>
              <h2 className="text-2xl md:text-3xl font-black mt-2 tracking-tighter">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoEstimado)}
              </h2>
            </CardContent>
          </Card>
        </div>

        {/* GRÁFICO DE BARRAS */}
        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2rem]">
          <div className="bg-gray-50 px-6 md:px-8 py-5 border-b border-gray-100">
            <h3 className="text-gray-800 font-black flex items-center gap-2 uppercase tracking-widest text-[11px]">
              <TrendingUp size={16} className="text-blue-600"/> Distribuição
            </h3>
          </div>
          <CardContent className="p-6 md:p-8 space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                  <span className="text-green-600 flex items-center gap-2"><CheckCircle size={16}/> Presenças</span>
                  <span className="text-gray-600">{stats.presencas} ({calcularPorcentagem(stats.presencas).toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-50 rounded-full h-5 shadow-inner"><div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${calcularPorcentagem(stats.presencas)}%` }}></div></div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                  <span className="text-red-500 flex items-center gap-2"><XCircle size={16}/> Faltas</span>
                  <span className="text-gray-600">{stats.faltas} ({calcularPorcentagem(stats.faltas).toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-50 rounded-full h-5 shadow-inner"><div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${calcularPorcentagem(stats.faltas)}%` }}></div></div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                  <span className="text-orange-500 flex items-center gap-2"><AlertCircle size={16}/> Justificadas</span>
                  <span className="text-gray-600">{stats.justificadas} ({calcularPorcentagem(stats.justificadas).toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-50 rounded-full h-5 shadow-inner"><div className="bg-orange-400 h-full rounded-full transition-all" style={{ width: `${calcularPorcentagem(stats.justificadas)}%` }}></div></div>
              </div>
          </CardContent>
        </Card>

        {/* RODAPÉ DO RELATÓRIO (APARECE SÓ NO PDF) */}
        <div className="hidden print:block text-center text-[10px] font-bold text-gray-400 pt-10 border-t uppercase tracking-widest">
          Relatório gerado automaticamente pelo Sistema SerClin em {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </div>
      </div>
    </div>
  );
}
