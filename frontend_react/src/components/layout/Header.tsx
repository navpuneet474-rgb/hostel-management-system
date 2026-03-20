import { Button, Dropdown, Avatar, Typography, Space } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLogout } from '../../hooks';
import type { MenuProps } from 'antd';

const { Text } = Typography;

interface HeaderProps {
  title?: string;
  showUserMenu?: boolean;
}

export const Header = ({ title, showUserMenu = true }: HeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logout, loading: loggingOut } = useLogout();

  const handleLogout = () => {
    logout();
  };

  const handleProfileClick = () => {
    if (user) {
      const profileRoutes: Record<string, string> = {
        student: '/student/profile',
        warden: '/warden/profile',
        security: '/security/profile',
        maintenance: '/maintenance/profile',
        admin: '/admin/profile',
        staff: '/warden/profile'
      };
      
      const profileRoute = profileRoutes[user.userType] || '/profile';
      navigate(profileRoute);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          <span>Profile</span>
        </Space>
      ),
      onClick: handleProfileClick,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          <span>Logout</span>
        </Space>
      ),
      onClick: handleLogout,
      danger: true,
    },
  ];

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.name || user.email.split('@')[0];
  };

  const getRoleDisplayName = () => {
    if (!user) return '';
    
    const roleNames: Record<string, string> = {
      student: 'Student',
      warden: 'Warden',
      security: 'Security',
      maintenance: 'Maintenance',
      admin: 'Administrator',
      staff: 'Staff'
    };
    
    return roleNames[user.userType] || user.userType;
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 24px',
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div>
        {title && (
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        )}
      </div>

      {showUserMenu && user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <Text strong>{getUserDisplayName()}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {getRoleDisplayName()}
            </Text>
          </div>
          
          <Dropdown 
            menu={{ items: userMenuItems }} 
            placement="bottomRight"
            trigger={['click']}
          >
            <Button 
              type="text" 
              shape="circle" 
              size="large"
              loading={loggingOut}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Avatar 
                size="default" 
                src={user.profile?.avatar} 
                icon={<UserOutlined />}
              />
            </Button>
          </Dropdown>
        </div>
      )}
    </div>
  );
};