import { useEffect } from "react";
import { Hero } from "./Hero";
import { Services } from "./Services";
import { About } from "./About";
import { Plans } from "./Plans";
import { Covenants } from "./Covenants";
import { Award, ShieldCheck } from "lucide-react";

interface HomeProps {
  setView: (view: string) => void;
  setPreselectedDoctorId?: (id: string | null) => void;
}

export default function Home({ setView, setPreselectedDoctorId }: HomeProps) {

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900 selection:bg-secondary mt-[60px]" id="serclin-homepage-main">
      <main className="relative">
        <Hero setView={setView} />
        
        <div className="relative z-10 -mt-24 px-4 md:px-0">
          <About />
        </div>

        <section id="servicos" className="py-24 md:py-40 bg-white">
          <div className="container mx-auto px-4 max-w-7xl text-center">
            <div className="max-w-4xl mx-auto text-center mb-16 md:mb-24 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary">Especialidades</span>
              <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter italic leading-[0.8] text-primary">
                Nossa <span className="font-light text-slate-500 not-italic font-sans lowercase">Entrega</span>
              </h2>
            </div>
            <Services />
          </div>
        </section>

        <section id="convenios" className="py-24 md:py-40 bg-primary text-white">
          <div className="container mx-auto px-4 max-w-7xl">
            <Covenants />
          </div>
        </section>

        <section id="planos" className="py-24 md:py-40 bg-slate-50">
          <div className="container mx-auto px-4 max-w-7xl text-center">
            <div className="text-center mb-16 md:mb-24 space-y-4">
               <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter italic leading-[0.8] text-primary">
                Seu <span className="font-light text-slate-500 not-italic font-sans lowercase">Investimento</span>
              </h2>
            </div>
            <Plans />
          </div>
        </section>

        {/* --- FORMULÁRIO SALESFORCE COM TODAS AS FUNÇÕES RESTAURADAS --- */}
        <section id="contato" className="py-24 md:py-40 bg-white border-t border-slate-100">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="max-w-6xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden grid md:grid-cols-2 border border-slate-100">
              
              <div className="bg-primary p-12 md:p-20 text-white flex flex-col justify-between relative overflow-hidden text-left">
                <div className="relative z-10 space-y-8">
                  <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic leading-[0.8]">
                    Inicie sua<br/><span className="text-secondary not-italic font-sans">Jornada</span>
                  </h2>
                  <div className="h-1 w-20 bg-secondary"></div>
                  <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed">
                    Um ambiente seguro para o seu desenvolvimento. Agende seu atendimento exclusivo.
                  </p>
                </div>
                <div className="relative z-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/35 mt-10 md:mt-0">
                  <ShieldCheck size={20} className="text-secondary" /> Protocolo de Sigilo Ético
                </div>
                <div className="absolute -bottom-20 -right-10 text-[20rem] font-black text-white/5 italic select-none pointer-events-none uppercase tracking-tighter">SC</div>
              </div>

              <div className="p-8 md:p-24 bg-white">
                <form action="https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8" method="POST" className="space-y-6">
                  
                  {/* FUNÇÕES SISTÊMICAS RESTAURADAS */}
                  <input type="hidden" name="oid" value="00DgL00000L3Dav" />
                  <input type="hidden" name="retURL" value="https://institutoserclin.vercel.app/obrigado" />
                  <input type="hidden" name="company" value="Instituto SerClin - Site" />
                  <input type="hidden" name="lead_source" value="Web" />
                  <input type="hidden" name="lead_status" value="Aberto - Não contatado" />

                  <div className="space-y-6 text-left">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 block mb-1">Identificação</label>
                      <input 
                        name="last_name" 
                        type="text" 
                        required 
                        className="w-full p-4 border-b-2 border-slate-100 focus:border-secondary outline-none text-primary font-bold text-lg transition-all" 
                        placeholder="Nome Completo" 
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 block mb-1">WhatsApp (Celular)</label>
                      <input 
                        name="phone" 
                        type="tel" 
                        required 
                        className="w-full p-4 border-b-2 border-slate-100 focus:border-secondary outline-none text-primary font-bold text-lg transition-all" 
                        placeholder="(68) 99999-9999"
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "");
                          if (v.length > 11) v = v.slice(0, 11);
                          if (v.length > 10) v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
                          else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
                          else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
                          e.target.value = v;
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 block mb-1">Área de Interesse</label>
                      <select 
                        name="00NgL00003Dnk2H" 
                        className="w-full p-4 border-b-2 border-slate-100 focus:border-secondary outline-none text-primary font-bold text-lg bg-transparent cursor-pointer"
                      >
                        <option value="">-- Selecione --</option>
                        <option value="Neuropsicologia">Neuropsicologia</option>
                        <option value="Psicopedagogia">Psicopedagogia</option>
                        <option value="Psicoterapia">Psicoterapia</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-secondary text-white hover:text-primary font-black py-6 rounded-2xl uppercase text-[11px] tracking-[0.4em] shadow-xl transition-all active:scale-95 cursor-pointer border-none"
                    >
                      Solicitar Atendimento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        
      </main>
    </div>
  );
}
