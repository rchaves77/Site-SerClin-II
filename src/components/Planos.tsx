import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Wallet, Link as LinkIcon, Users, ArrowLeft } from "lucide-react"; 
import { formatCurrency } from "@/lib/utils";

interface PlanosProps {
  setView: (view: string) => void;
}

export function Planos({ setView }: PlanosProps) {
  const navigate = (path: string) => {
    setView("acessos"); 
  };

  const [planos, setPlanos] = useState<any[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [novoPlano, setNovoPlano] = useState({ nome: "", valor: "", frequencia: "Mensal" });
  const [vinculo, setVinculo] = useState({ pacienteId: "", planoId: "" });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const { data: planosData } = await supabase.from("planos").select("*").order("nome");
    const { data: pacientesData } = await supabase.from("pacientes").select("*").order("nome");
    if (planosData) setPlanos(planosData);
    if (pacientesData) setPacientes(pacientesData);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCriarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPlano.nome || !novoPlano.valor) return toast.error("Preencha nome e valor.");
    setLoading(true);
    const { error } = await supabase.from("planos").insert([{
      nome: novoPlano.nome,
      valor: parseFloat(novoPlano.valor.replace(",", ".")),
      frequencia: novoPlano.frequencia
    }]);
    setLoading(false);
    if (error) toast.error("Erro ao criar plano.");
    else { toast.success("Plano criado!"); setNovoPlano({ nome: "", valor: "", frequencia: "Mensal" }); fetchData(); }
  };

  const handleVincular = async () => {
    if (!vinculo.pacienteId || !vinculo.planoId) return toast.error("Selecione paciente e plano.");
    setLoading(true);
    const { error } = await supabase.from("pacientes").update({ plano_id: vinculo.planoId }).eq("id", vinculo.pacienteId);
    setLoading(false);
    if (error) toast.error("Erro ao vincular.");
    else { toast.success("Paciente vinculado com sucesso!"); setVinculo({ pacienteId: "", planoId: "" }); fetchData(); }
  };

  const receitaMensal = pacientes.reduce((total, paciente) => {
    const planoDoPaciente = planos.find(p => p.id === paciente.plano_id);
    if (planoDoPaciente && planoDoPaciente.frequencia === 'Mensal') {
      return total + (planoDoPaciente.valor || 0);
    }
    return total;
  }, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans space-y-8 text-left mt-20">
      {/* CABEÇALHO ATUALIZADO COM BOTÃO VOLTAR */}
      <header className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/sistema')} 
          className="rounded-full border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-black text-[#1e3a8a] uppercase flex items-center gap-3">
            <Wallet className="text-emerald-600" size={28} /> Gestão de Planos e Receitas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cadastre seus planos e vincule aos pacientes para projetar sua receita.</p>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-emerald-700 uppercase">Receita Mensal Recorrente (Estimada)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-emerald-600">{formatCurrency(receitaMensal)}</p>
            <p className="text-xs text-gray-400 mt-2">Baseado nos pacientes com planos mensais ativos.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-gray-100">
          <CardHeader><CardTitle className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><Plus size={16} className="text-blue-600" /> Criar Novo Plano</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCriarPlano} className="flex gap-4 items-end">
              <div className="flex-1 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Nome do Plano</label>
                <Input value={novoPlano.nome} onChange={e => setNovoPlano({ ...novoPlano, nome: e.target.value })} placeholder="Ex: Plano Individual" required className="bg-gray-50 h-10 text-sm font-bold" /></div>
              <div className="w-32 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Valor (R$)</label>
                <Input type="number" step="0.01" value={novoPlano.valor} onChange={e => setNovoPlano({ ...novoPlano, valor: e.target.value })} placeholder="0,00" required className="bg-gray-50 h-10 text-sm font-bold" /></div>
              <div className="w-40 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Frequência</label>
                <Select value={novoPlano.frequencia} onValueChange={v => setNovoPlano({ ...novoPlano, frequencia: v })}>
                  <SelectTrigger className="bg-gray-50 h-10 text-sm font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Mensal">Mensal</SelectItem><SelectItem value="Anual">Anual</SelectItem></SelectContent>
                </Select></div>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-bold uppercase text-xs cursor-pointer">Salvar</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-gray-100">
          <CardHeader><CardTitle className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><LinkIcon size={16} className="text-purple-600" /> Vincular Paciente a Plano</CardTitle></CardHeader>
          <CardContent className="space-y-4 font-sans text-left">
            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Paciente</label>
              <Select value={vinculo.pacienteId} onValueChange={v => setVinculo({ ...vinculo, pacienteId: v })}>
                <SelectTrigger className="bg-gray-50 h-10 text-sm font-bold cursor-pointer"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{pacientes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Plano</label>
              <Select value={vinculo.planoId} onValueChange={v => setVinculo({ ...vinculo, planoId: v })}>
                <SelectTrigger className="bg-gray-50 h-10 text-sm font-bold cursor-pointer"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{planos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.valor)}</SelectItem>)}</SelectContent>
              </Select></div>
            <Button onClick={handleVincular} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 h-10 font-bold uppercase text-xs cursor-pointer">Confirmar Vínculo</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-gray-100 overflow-hidden">
          <CardHeader className="bg-gray-50"><CardTitle className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><Users size={16} className="text-blue-600" /> Visão Geral dos Planos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[400px]">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 bg-white sticky top-0 z-10 border-b">
                  <tr><th className="px-6 py-3">Plano</th><th className="px-6 py-3">Valor</th><th className="px-6 py-3">Pacientes Vinculados</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {planos.map(plano => {
                    const vinculados = pacientes.filter(p => p.plano_id === plano.id);
                    return (
                      <tr key={plano.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">{plano.nome}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(plano.valor)}<span className="text-xs text-gray-400 ml-1 font-normal font-sans">/{plano.frequencia.toLowerCase()}</span></td>
                        <td className="px-6 py-4">
                          {vinculados.length > 0 ? (
                            <div className="flex flex-wrap gap-2">{vinculados.map(p => <span key={p.id} className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">{p.nome}</span>)}</div>
                          ) : <span className="text-xs text-gray-400 italic">Nenhum vínculo.</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
