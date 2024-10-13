interface TitleProps {
  children: React.ReactNode;
  text: string;
  setUseState: React.Dispatch<React.SetStateAction<boolean>>;
  state: boolean;
}

export function Title({ children, text, setUseState, state }: TitleProps) {
  return (
    <div className="border-2 border-sky-500 select-none">
      <h2
        className="module-title cursor-pointer"
        onClick={() => setUseState(!state)}
      >
        {text}
      </h2>
      {state && children}
    </div>
  );
}
