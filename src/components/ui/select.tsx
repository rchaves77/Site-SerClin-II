import { ReactNode, createContext, useContext } from "react";

const SelectContext = createContext<{
  value?: string;
  onValueChange?: (val: string) => void;
  disabled?: boolean;
} | null>(null);

export function Select({
  children,
  value,
  onValueChange,
  disabled,
}: {
  children: ReactNode;
  value?: string;
  onValueChange?: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <SelectContext.Provider value={{ value, onValueChange, disabled }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center justify-between w-full rounded-xl px-4 py-2 text-xs font-bold bg-gray-100 ${className}`}>
      {children}
      <span className="ml-2 text-gray-400">▼</span>
    </div>
  );
}

export function SelectValue({ placeholder = "Selecione" }: { placeholder?: string }) {
  const ctx = useContext(SelectContext);
  const labelMap: Record<string, string> = {
    admin: "Administrador",
    secretaria: "Secretária",
    profissional: "Profissional",
    todos: "Todos Profissionais",
    "0": "Janeiro",
    "1": "Fevereiro",
    "2": "Março",
    "3": "Abril",
    "4": "Maio",
    "5": "Junho",
    "6": "Julho",
    "7": "Agosto",
    "8": "Setembro",
    "9": "Outubro",
    "10": "Novembro",
    "11": "Dezembro",
  };
  const displayVal = ctx?.value ? (labelMap[ctx.value] || ctx.value) : placeholder;
  return <span className="uppercase text-[10px] font-black tracking-wider text-gray-700">{displayVal}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  const ctx = useContext(SelectContext);
  return (
    <select
      disabled={ctx?.disabled}
      value={ctx?.value || ""}
      onChange={(e) => ctx?.onValueChange?.(e.target.value)}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-left uppercase text-[10px] font-black bg-white text-gray-800"
    >
      {children}
    </select>
  );
}

export function SelectItem({ children, value }: { children: ReactNode; value: string }) {
  return (
    <option value={value} className="text-gray-800 uppercase text-[10px] font-black">
      {children}
    </option>
  );
}
