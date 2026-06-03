"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-zinc-950 px-4 text-center">
          <p className="text-red-400 font-bold mb-2">Something crashed!</p>
          <p className="text-zinc-400 text-xs mb-4 text-left bg-black/50 p-4 rounded-xl max-w-full overflow-auto max-h-64 font-mono break-all">
            {this.state.error?.toString()}
            <br/><br/>
            {this.state.errorInfo?.componentStack}
          </p>
          <Button size="lg" className="rounded-full h-14 font-bold px-8" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
