
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { Logger } from '../services/logger';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | string | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: any): State {
    let errorMsg = 'Unknown Error';
    if (error instanceof Error) {
        errorMsg = error.toString();
    } else if (typeof error === 'object') {
        try {
            errorMsg = JSON.stringify(error, null, 2);
        } catch {
            errorMsg = String(error);
        }
    } else {
        errorMsg = String(error);
    }
    return { hasError: true, error: errorMsg };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Log crash to database
    Logger.crash(error, errorInfo.componentStack);
  }

  private handleReset = () => {
    if (window.confirm("Isso apagará os dados locais para recuperar o sistema. Você tem certeza?")) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/'; // Go to root before reloading
    }
  };

  private handleReload = () => {
      window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Algo deu errado</h1>
            <p className="text-gray-500 mb-6">
              Ocorreu um erro inesperado. Um relatório foi gerado internamente.
            </p>

            <div className="bg-gray-100 p-4 rounded-lg mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-gray-700 whitespace-pre-wrap">
                {String(this.state.error)}
            </div>

            <div className="space-y-3">
                <button 
                    onClick={this.handleReload}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                    <RefreshCw size={18} /> Tentar Recarregar
                </button>

                <button 
                    onClick={this.handleReset}
                    className="w-full py-3 bg-white border-2 border-red-100 text-red-600 rounded-lg font-bold hover:bg-red-50 flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} /> Limpar Dados e Recuperar
                </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
