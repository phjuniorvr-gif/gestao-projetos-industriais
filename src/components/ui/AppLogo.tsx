interface AppLogoProps {
  className?: string;
}

/** Logo da empresa — arquivo enviado pelo usuário (`public/logo.jpeg`). */
export function AppLogo({ className = 'h-8 w-8' }: AppLogoProps) {
  return <img src="/logo.jpeg" alt="" className={`shrink-0 rounded-md object-cover ${className}`} />;
}
