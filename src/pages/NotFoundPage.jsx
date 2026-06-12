import { useNavigate } from 'react-router-dom';
import AppStatusView from '../components/AppStatusView';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <AppStatusView
      actions={[
        { label: 'Go to Admin Dashboard', onClick: () => navigate('/admin') },
        { label: 'Go Back', onClick: () => navigate(-1), tone: 'secondary' },
      ]}
      state={{
        statusCode: 404,
        title: 'Page Not Found',
        message: 'This admin page does not exist or has not been built yet.',
      }}
    />
  );
}
