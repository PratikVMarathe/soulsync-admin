import { Component } from 'react';
import AppStatusView from './AppStatusView';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SoulSync Admin UI crashed:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      const errorState = resolveAppErrorState(this.state.error, this.props.fallbackState);
      const actions = this.props.actions || [
        { label: 'Try Again', onClick: this.handleRetry },
        { label: 'Reload', onClick: () => window.location.reload(), tone: 'secondary' },
      ];

      return <AppStatusView compact={this.props.compact} state={errorState} actions={actions} />;
    }

    return this.props.children;
  }
}
