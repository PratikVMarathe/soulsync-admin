import './index.css';
import { AppNoticeProvider } from './context/AppNoticeContext';
import AdminWorkspace from './AdminWorkspace';

export default function AdminModule(props) {
  return (
    <AppNoticeProvider>
      <AdminWorkspace {...props} />
    </AppNoticeProvider>
  );
}
