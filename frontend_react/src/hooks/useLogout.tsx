import { useState } from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { confirm } = Modal;

export const useLogout = () => {
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (options?: { 
    skipConfirmation?: boolean;
    redirectTo?: string;
    onSuccess?: () => void;
    onError?: (error: any) => void;
  }) => {
    const { 
      skipConfirmation = false, 
      redirectTo = '/login',
      onSuccess,
      onError 
    } = options || {};

    const performLogout = async () => {
      setLoading(true);
      try {
        await logout();
        navigate(redirectTo, { replace: true });
        onSuccess?.();
      } catch (error) {
        console.error('Logout error:', error);
        onError?.(error);
      } finally {
        setLoading(false);
      }
    };

    if (skipConfirmation) {
      performLogout();
    } else {
      confirm({
        title: 'Confirm Logout',
        icon: <ExclamationCircleOutlined />,
        content: 'Are you sure you want to log out?',
        okText: 'Yes, Log Out',
        cancelText: 'Cancel',
        okType: 'danger',
        onOk: performLogout,
      });
    }
  };

  return {
    logout: handleLogout,
    loading
  };
};