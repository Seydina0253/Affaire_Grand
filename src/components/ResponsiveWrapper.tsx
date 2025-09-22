import { ReactNode } from "react";

interface ResponsiveWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function ResponsiveWrapper({ children, className = "" }: ResponsiveWrapperProps) {
  return (
    <div className={`min-h-screen bg-background ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}