import React from 'react';

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ background: '#1a0010', color: '#ff6b6b', padding: 32, fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}>
                    <h2>🔴 React Error Boundary</h2>
                    <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {this.state.error.message}
                        {'\n\n'}
                        {this.state.error.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}
