import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { 
  User, Plus, Search, FileText, Trash2, Edit, X, Save, ArrowLeft, 
  Camera, ImageIcon, Check, ZoomIn, MessageCircle, Cake, AlertTriangle, ShieldAlert, MapPin, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePerfil } from "@/hooks/usePerfil";
import { differenceInDays, isSameDay, parseISO } from "date-fns";

// --- UTILITÁRIOS PARA CORTE DE IMAGEM ---
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((file) => resolve(file), 'image/jpeg', 0.9);
  });
}

const CONVENIOS = ["Particular", "SINODONTO", "SINPROAC", "SINTEAC", "COMUNIDADE", "IGREJAS"];

interface PacientesProps {
  setView: (view: string) => void;
}

export function Pacientes({ setView }: PacientesProps) {
  const { isAdmin, isSecretaria } = usePerfil();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meuPerfil, setMeuPerfil] = useState<any>(null);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [fotoFinal, setFotoFinal] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: null, nome: "", cpf: "", data_nascimento: "", genero: "Feminino", 
    endereco: "", telefone: "", convenio: "Particular", foto_url: "",
    responsavel_nome: "", responsavel_cpf: "",
    anamnese: "", observacoes: ""
  });

  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pLogado } = await supabase.from('perfis').select('*').eq('email', user.email).single();
        if (pLogado) setMeuPerfil(pLogado);
      }

      const { data, error } = await supabase
        .from("pacientes")
        .select(`*, agendamentos (data_inicio)`)
        .order("nome", { ascending: true });

      if (!error && data) {
        const processados = data.map(pac => {
          const datas = pac.agendamentos?.map((a: any) => new Date(a.data_inicio)) || [];
          const ultima = datas.length > 0 ? new Date(Math.max(...datas.map(d => d.getTime()))) : null;
          return { ...pac, ultimaConsulta: ultima };
        });
        setPacientes(processados);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPacientes(); }, []);

  const abrirWhatsApp = async (numero: string, nomePaciente: string) => {
    const limpo = numero.replace(/\D/g, "");
    if (limpo.length < 10) return toast.error("Telefone inválido.");
    const { data: { user } } = await supabase.auth.getUser();
    let remetente = user?.user_metadata?.full_name || "Equipe SerClin";
    if (user?.email === 'romulochaves77@gmail.com') remetente = "Dr. Rômulo Chaves";
    const saudacao = `Olá ${nomePaciente}, tudo bem? Aqui é o(a) ${remetente} do Instituto SerClin.`;
    window.open(`https://wa.me/55${limpo}?text=${encodeURIComponent(saudacao)}`, "_blank");
  };

  const handleTelefone = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2 - $3");
    else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2 - $3");
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    else if (v.length > 0) v = v.replace(/^(\d*)/, "($1");
    setForm({ ...form, telefone: v });
  };

  const onFileChange = async (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsCropping(true);
        setZoom(1);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    if (blob) {
      setFotoFinal(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setIsCropping(false);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let urlDaFoto = form.foto_url;
      if (fotoFinal) {
        const fileName = `${Date.now()}-perfil.jpg`;
        const { error: upErr } = await supabase.storage.from('fotos-perfil').upload(fileName, fotoFinal);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('fotos-perfil').getPublicUrl(fileName);
        urlDaFoto = data.publicUrl;
      }
      
      const { ultimaConsulta, agendamentos, ...newPayload } = form as any;
      const payload = { ...newPayload, foto_url: urlDaFoto };

      if (payload.data_nascimento === "") {
        payload.data_nascimento = null;
      }

      if (form.id) { 
        const { error } = await supabase.from("pacientes").update(payload).eq("id", form.id); 
        if (error) throw error;
        toast.success("Atualizado!"); 
      } else { 
        const { id, ...insertPayload } = payload; 
        const { error } = await supabase.from("pacientes").insert([insertPayload]); 
        if (error) throw error;
        toast.success("Cadastrado!"); 
      }
      limparModal(); fetchPacientes();
    } catch (error: any) { 
      toast.error(error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const limparModal = () => {
    setIsModalOpen(false); setIsCropping(false); setFotoFinal(null); setPreviewUrl(null); setImageSrc(null);
    setForm({id: null, nome: "", cpf: "", data_nascimento: "", genero: "Feminino", endereco: "", telefone: "", convenio: "Particular", foto_url: "", responsavel_nome: "", responsavel_cpf: "", anamnese: "", observacoes: ""});
  };

  const inputClass = "flex w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium transition-all";

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-left text-gray-800 mt-20">
      
      {/* HEADER */}
      <header className="bg-white border-b px-4 md:px-10 shadow-sm sticky top-0 z-40 flex flex-col justify-center min-h-[calc(70px+var(--safe-top))] pt-[calc(var(--safe-top)+12px)]">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setView("acessos")} className="p-2 -ml-2 text-gray-400 hover:bg-transparent cursor-pointer">
              <ArrowLeft size={24} />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter leading-none">Pacientes</h1>
              <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gestão SerClin</p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar..." className="bg-gray-50 border-none h-10 pl-9 text-xs rounded-xl" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            
            {(isAdmin || isSecretaria || meuPerfil?.permissao_agendar) && (
              <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 font-black uppercase text-[10px] h-10 px-5 rounded-xl shadow-md cursor-pointer border-none text-white">
                <Plus size={16} className="mr-1"/> Novo
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 md:p-10 max-w-7xl mx-auto pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.cpf?.includes(busca)).map((p) => {
             const diasAusente = p.ultimaConsulta ? differenceInDays(new Date(), p.ultimaConsulta) : null;
             const eAniversariante = p.data_nascimento && isSameDay(new Date(), parseISO(p.data_nascimento));

             return (
              <Card key={p.id} className="border-none shadow-sm bg-white overflow-hidden rounded-[2rem] hover:shadow-md transition-all border border-gray-100">
                <CardContent className="p-6 md:p-8">
                  <div className="flex gap-4 items-start mb-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-xl md:text-2xl font-black uppercase shrink-0 overflow-hidden border-2 border-white shadow-sm">
                      {p.foto_url ? <img src={p.foto_url} className="w-full h-full object-cover" alt={p.nome} /> : p.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-gray-800 uppercase text-md md:text-lg leading-tight truncate mb-1">{p.nome}</h3>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase">{p.convenio}</span>
                          {eAniversariante && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase flex items-center gap-1"><Cake size={10}/> Níver!</span>}
                      </div>
                      
                      {p.telefone && (
                        <button onClick={() => abrirWhatsApp(p.telefone, p.nome)} className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black border border-green-100 hover:bg-green-600 hover:text-white transition-all cursor-pointer">
                          <MessageCircle size={12} className="fill-current" /> {p.telefone}
                        </button>
                      )}
                    </div>
                  </div>

                  {diasAusente !== null && diasAusente >= 90 && (
                     <div className="mb-4 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center justify-between text-amber-700">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} />
                          <span className="text-[9px] font-black uppercase">Ausente {diasAusente} dias</span>
                        </div>
                        <button className="text-[9px] font-black uppercase underline cursor-pointer border-none bg-transparent text-amber-700 font-sans" onClick={() => abrirWhatsApp(p.telefone, p.nome)}>Chamar</button>
                     </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-50">
                    <Button variant="outline" className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-pointer" onClick={() => setView(`pacientes-${p.id}`)}>
                      <FileText size={16} className="mr-1.5"/> Prontuário
                    </Button>

                    {(isAdmin || isSecretaria || meuPerfil?.permissao_excluir) && (
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-gray-300 hover:text-blue-600 hover:bg-blue-50 cursor-pointer" onClick={() => { 
                    setForm({ 
                     id: p.id, 
                    nome: p.nome || "", 
                    cpf: p.cpf || "", 
                    data_nascimento: p.data_nascimento || "", 
                    genero: p.genero || "Feminino", 
                    endereco: p.endereco || "", 
                    telefone: p.telefone || "", 
                    convenio: p.convenio || "Particular", 
                    foto_url: p.foto_url || "", 
                    responsavel_nome: p.responsavel_nome || "", 
                    responsavel_cpf: p.responsavel_cpf || "", 
                    anamnese: p.anamnese || "", 
                    observacoes: p.observacoes || "" 
                    }); 
                      setPreviewUrl(p.foto_url); 
                      setIsModalOpen(true); 
                     }}>
                    <Edit size={18}/>
                    </Button>
                    )}
                    
                  </div>
                </CardContent>
              </Card>
             )
          })}
        </div>
      </main>

      {/* MODAL ADAPTADO PARA MOBILE TELA CHEIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center md:p-4 backdrop-blur-md">
          <div className="bg-white md:rounded-[2.5rem] shadow-2xl w-full max-w-2xl h-full md:h-[90vh] overflow-hidden flex flex-col font-sans">
            {isCropping ? (
              <div className="h-full flex flex-col bg-gray-900 pt-[var(--safe-top)]">
                <div className="p-6 flex justify-between items-center text-white">
                  <h3 className="font-bold uppercase text-xs tracking-widest">Ajustar Foto</h3>
                  <X className="cursor-pointer" onClick={() => setIsCropping(false)} />
                </div>
                <div className="relative flex-1 min-h-[300px]">
                  <Cropper image={imageSrc || ""} crop={crop} zoom={zoom} aspect={1} cropShape="round" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                </div>
                <div className="p-8 bg-white space-y-6">
                  <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <Button onClick={confirmCrop} className="w-full bg-blue-600 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl border-none cursor-pointer">Confirmar Foto</Button>
                </div>
              </div>
            ) : (
              <>
                {/* CABEÇALHO DO MODAL */}
                <div className="bg-white px-6 md:px-8 py-5 flex justify-between items-center border-b sticky top-0 z-10 pt-[calc(var(--safe-top)+12px)] shrink-0">
                  <h3 className="font-black text-gray-800 uppercase text-xs md:text-sm tracking-widest">{form.id ? "Editar Registro" : "Novo Cadastro"}</h3>
                  <button onClick={limparModal} className="p-2 -mr-2 text-gray-400 hover:text-red-500 cursor-pointer border-none bg-transparent"><X size={24}/></button>
                </div>

                {/* ÁREA DE SCROLL DO FORMULÁRIO */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  <form id="pacienteForm" onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    
                    <div className="md:col-span-2 flex flex-col items-center mb-4">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {previewUrl ? <img src={previewUrl} className="w-28 h-28 md:w-32 md:h-32 rounded-[2rem] object-cover border-4 border-blue-50 shadow-lg" alt="Preview" /> : (
                          <div className="w-28 h-28 md:w-32 md:h-32 rounded-[2rem] bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200 group-hover:border-blue-400 transition-all"><Camera className="text-gray-300" size={32}/></div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg"><ImageIcon size={16}/></div>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome Completo</label>
                      <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className={inputClass} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CPF</label>
                      <input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} className={inputClass} placeholder="000.000.000-00" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Nasc.</label>
                      <input type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} className={inputClass} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Telefone</label>
                      <input value={form.telefone} onChange={handleTelefone} className={inputClass} placeholder="(00) 00000-0000" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Convênio</label>
                      <Select value={form.convenio} onValueChange={v => setForm({...form, convenio: v})}>
                        <SelectTrigger className="bg-white h-[52px] rounded-xl border-gray-200 cursor-pointer"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONVENIOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={12}/> Endereço</label>
                      <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} className={inputClass} placeholder="Rua, bairro..." />
                    </div>

                    <div className="md:col-span-2 pt-4 mt-2 border-t border-dashed">
                       <p className="text-[10px] font-black text-blue-600 uppercase mb-4 flex items-center gap-2 tracking-widest"><ShieldAlert size={14}/> Responsável Legal</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Nome Responsável</label>
                            <input value={form.responsavel_nome} onChange={e => setForm({...form, responsavel_nome: e.target.value})} className={inputClass} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">CPF Responsável</label>
                            <input value={form.responsavel_cpf} onChange={e => setForm({...form, responsavel_cpf: e.target.value})} className={inputClass} placeholder="000.000.000-00" />
                          </div>
                       </div>
                    </div>

                    <div className="md:col-span-2 space-y-4 pt-4 mt-2 border-t border-dashed pb-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <ClipboardList size={12}/> Anamnese / Histórico Clínico
                        </label>
                        <textarea rows={4} value={form.anamnese} onChange={e => setForm({...form, anamnese: e.target.value})} className={`${inputClass} min-h-[120px] resize-none py-3`} placeholder="Alergias, medicações..." />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Internas</label>
                        <input value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} className={inputClass} />
                      </div>
                    </div>
                  </form>
                </div>

                {/* RODAPÉ FIXO DO MODAL */}
                <div className="bg-white border-t p-4 md:p-6 shrink-0 z-10 flex flex-col md:flex-row-reverse gap-3 pb-[calc(var(--safe-bottom)+16px)]">
                  <Button type="submit" form="pacienteForm" disabled={loading} className="w-full md:w-auto bg-blue-600 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl flex-1 cursor-pointer border-none">
                    {loading ? "Salvando..." : "Salvar Cadastro"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={limparModal} className="w-full md:w-auto font-black h-14 px-8 rounded-2xl uppercase text-[10px] tracking-widest text-gray-400 cursor-pointer">
                    CANCELAR
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
