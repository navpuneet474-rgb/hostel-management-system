import type { ReactNode } from "react";
import { ResponsiveNavigation } from "../components/layout/ResponsiveNavigation";
import { useMobileOptimization } from "../hooks/useMobileOptimization";

export const AppShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const { isMobile } = useMobileOptimization();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ResponsiveNavigation />
        
        {/* Main Content */}
        <main className="pb-20"> {/* Bottom padding for mobile navigation */}
          <div className="safe-area-pt">
            {/* Page Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h1>
            </div>
            
            {/* Page Content */}
            <div className="p-4">
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-gray-50">
      <ResponsiveNavigation />
      
      {/* Main Content */}
      <main>
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">
            {title}
          </h1>
        </div>
        
        {/* Page Content */}
        <div className="page-shell">
          {children}
        </div>
      </main>
    </div>
  );
};
