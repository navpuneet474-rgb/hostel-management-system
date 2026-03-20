import { useState, useEffect } from "react";
import { Alert, Button, Card, Form, Input, Radio, Typography, message, Spin } from "antd";
import { BankOutlined, LockOutlined, MailOutlined, TeamOutlined, UserOutlined, SecurityScanOutlined, ToolOutlined, CrownOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import type { UserType } from "../types";

interface LoginForm {
  email: string;
  password: string;
  user_type: UserType;
}

interface LoginError {
  message: string;
  field?: keyof LoginForm;
}

export const LoginPage = () => {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, loading: authLoading } = useAuth();

  const selectedRole = Form.useWatch("user_type", form) || "student";

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      const roleRedirects: Record<UserType, string> = {
        student: '/student/dashboard',
        warden: '/warden/dashboard',
        security: '/security/dashboard',
        maintenance: '/maintenance/dashboard',
        admin: '/admin/dashboard',
        staff: '/warden/dashboard'
      };
      
      const from = (location.state as any)?.from?.pathname || roleRedirects[user.userType];
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  const getRoleBasedRedirect = (userType: UserType): string => {
    const roleRedirects: Record<UserType, string> = {
      student: '/student/dashboard',
      warden: '/warden/dashboard', 
      security: '/security/dashboard',
      maintenance: '/maintenance/dashboard',
      admin: '/admin/dashboard',
      staff: '/warden/dashboard'
    };
    return roleRedirects[userType];
  };

  const validateForm = (values: LoginForm): LoginError | null => {
    if (!values.email) {
      return { message: "Email is required", field: "email" };
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      return { message: "Please enter a valid email address", field: "email" };
    }
    
    if (!values.password) {
      return { message: "Password is required", field: "password" };
    }
    
    if (values.password.length < 6) {
      return { message: "Password must be at least 6 characters long", field: "password" };
    }
    
    if (!values.user_type) {
      return { message: "Please select your role", field: "user_type" };
    }
    
    return null;
  };

  const onFinish = async (values: LoginForm) => {
    // Clear previous errors
    setError(null);
    
    // Client-side validation
    const validationError = validateForm(values);
    if (validationError) {
      setError(validationError);
      if (validationError.field) {
        form.scrollToField(validationError.field);
      }
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(values);
      
      if (!result.success) {
        const errorMessage = result.error || "Login failed. Please check your credentials.";
        setError({ message: errorMessage });
        
        // Focus on email field for retry
        setTimeout(() => {
          form.getFieldInstance('email')?.focus();
        }, 100);
        return;
      }

      // Set user in context
      const userData = {
        id: result.user?.id || "",
        name: result.user?.name || "",
        email: result.user?.email || values.email,
        userType: values.user_type,
        profile: result.user?.profile
      };
      
      setUser(userData);

      // Show success message
      message.success(result.message || "Login successful!");
      
      // Role-based redirect
      const redirectUrl = result.redirect_url || getRoleBasedRedirect(values.user_type);
      const from = (location.state as any)?.from?.pathname || redirectUrl;
      
      navigate(from, { replace: true });
      
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = "Unable to connect to server. Please check your internet connection and try again.";
      
      if (err.response?.status === 401) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Please contact your administrator.";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      }
      
      setError({ message: errorMessage });
      
      // Focus on email field for retry
      setTimeout(() => {
        form.getFieldInstance('email')?.focus();
      }, 100);
      
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: UserType) => {
    const iconProps = { style: { fontSize: 20, color: "#4f46e5" } };
    switch (role) {
      case "student": return <UserOutlined {...iconProps} />;
      case "warden": 
      case "staff": return <TeamOutlined {...iconProps} />;
      case "security": return <SecurityScanOutlined {...iconProps} />;
      case "maintenance": return <ToolOutlined {...iconProps} />;
      case "admin": return <CrownOutlined {...iconProps} />;
      default: return <UserOutlined {...iconProps} />;
    }
  };

  const getRoleLabel = (role: UserType) => {
    const labels: Record<UserType, string> = {
      student: "Student",
      warden: "Warden", 
      staff: "Staff",
      security: "Security",
      maintenance: "Maintenance",
      admin: "Admin"
    };
    return labels[role];
  };

  if ((loading && !error) || authLoading) {
    return (
      <div className="auth-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <Spin size="large" />
          <Typography.Text style={{ color: "rgba(255,255,255,0.75)" }}>
            Signing you in...
          </Typography.Text>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen flex items-center justify-center p-4">
      <div className="auth-float" style={{ top: 70, left: 40, width: 130, height: 130 }} />
      <div className="auth-float delay" style={{ top: 150, right: 70, width: 96, height: 96 }} />
      <div className="auth-float delay-2" style={{ bottom: 90, left: "28%", width: 170, height: 170 }} />

      <div style={{ width: "100%", maxWidth: 460, zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 78,
              height: 78,
              margin: "0 auto 14px auto",
              borderRadius: 18,
              background: "rgba(255,255,255,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BankOutlined style={{ color: "#fff", fontSize: 34 }} />
          </div>
          <Typography.Title level={2} style={{ color: "#fff", marginBottom: 4 }}>
            AI Powered Hostel Hub
          </Typography.Title>
          <Typography.Text style={{ color: "rgba(255,255,255,0.75)" }}>
            Welcome back. Sign in to continue.
          </Typography.Text>
        </div>

        <Card className="auth-glass-card" bodyStyle={{ padding: 28 }}>
          {error && (
            <Alert 
              showIcon 
              type="error" 
              message={error.message}
              style={{ marginBottom: 16 }}
              closable
              onClose={() => setError(null)}
            />
          )}
          
          <Form<LoginForm> 
            form={form} 
            layout="vertical" 
            onFinish={onFinish} 
            initialValues={{ user_type: "student" }}
            validateTrigger={["onBlur", "onChange"]}
          >
            <Form.Item 
              name="user_type" 
              label="Sign in as" 
              rules={[{ required: true, message: "Please select your role" }]}
              style={{ marginBottom: 14 }}
            >
              <Radio.Group style={{ display: "none" }}>
                <Radio value="student">Student</Radio>
                <Radio value="warden">Warden</Radio>
                <Radio value="security">Security</Radio>
                <Radio value="maintenance">Maintenance</Radio>
                <Radio value="admin">Admin</Radio>
                <Radio value="staff">Staff</Radio>
              </Radio.Group>
            </Form.Item>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", 
              gap: 10, 
              marginBottom: 16 
            }}>
              {(["student", "warden", "security", "maintenance", "admin"] as UserType[]).map((role) => (
                <div
                  key={role}
                  className={`user-type-tile ${selectedRole === role ? "active" : ""}`}
                  style={{ 
                    padding: 14, 
                    textAlign: "center", 
                    cursor: "pointer",
                    border: selectedRole === role ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    borderRadius: 8,
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => form.setFieldValue("user_type", role)}
                >
                  {getRoleIcon(role)}
                  <div style={{ fontWeight: 700, marginTop: 6, fontSize: 12 }}>
                    {getRoleLabel(role)}
                  </div>
                </div>
              ))}
            </div>

            <Form.Item 
              name="email" 
              label="Email" 
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Please enter a valid email address" }
              ]}
              validateStatus={error?.field === "email" ? "error" : ""}
              help={error?.field === "email" ? error.message : ""}
            >
              <Input 
                size="large" 
                prefix={<MailOutlined />} 
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </Form.Item>
            
            <Form.Item 
              name="password" 
              label="Password" 
              rules={[
                { required: true, message: "Password is required" },
                { min: 6, message: "Password must be at least 6 characters long" }
              ]}
              validateStatus={error?.field === "password" ? "error" : ""}
              help={error?.field === "password" ? error.message : ""}
            >
              <Input.Password 
                size="large" 
                prefix={<LockOutlined />} 
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </Form.Item>
            
            <Button 
              htmlType="submit" 
              type="primary" 
              block 
              loading={loading} 
              size="large"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};
