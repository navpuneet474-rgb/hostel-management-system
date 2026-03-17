import { useState } from "react";
import { Alert, Button, Card, Form, Input, Radio, Typography, message } from "antd";
import { BankOutlined, LockOutlined, MailOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { login } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import type { UserType } from "../types";

interface LoginForm {
  email: string;
  password: string;
  user_type: UserType;
}

export const LoginPage = () => {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const selectedRole = Form.useWatch("user_type", form) || "student";

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const result = await login(values);
      if (!result.success) {
        setError(result.error || "Login failed");
        return;
      }

      setUser({
        id: result.user?.id || "",
        name: result.user?.name || "",
        email: result.user?.email || values.email,
        userType: values.user_type,
      });

      message.success(result.message || "Login successful");
      navigate(result.redirect_url || "/student/dashboard");
    } catch {
      setError("Unable to login. Check server connection.");
    } finally {
      setLoading(false);
    }
  };

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
          <Typography.Text style={{ color: "rgba(255,255,255,0.75)" }}>Welcome back. Sign in to continue.</Typography.Text>
        </div>

        <Card className="auth-glass-card" bodyStyle={{ padding: 28 }}>
          {error && <Alert showIcon type="error" message={error} style={{ marginBottom: 16 }} />}
          <Form<LoginForm> form={form} layout="vertical" onFinish={onFinish} initialValues={{ user_type: "student" }}>
            <Form.Item name="user_type" label="Sign in as" style={{ marginBottom: 14 }}>
              <Radio.Group style={{ display: "none" }}>
                <Radio value="student">Student</Radio>
                <Radio value="staff">Staff</Radio>
              </Radio.Group>
            </Form.Item>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div
                className={`user-type-tile ${selectedRole === "student" ? "active" : ""}`}
                style={{ padding: 14, textAlign: "center", cursor: "pointer" }}
                onClick={() => form.setFieldValue("user_type", "student")}
              >
                <UserOutlined style={{ fontSize: 20, color: "#4f46e5" }} />
                <div style={{ fontWeight: 700, marginTop: 6 }}>Student</div>
              </div>
              <div
                className={`user-type-tile ${selectedRole === "staff" ? "active" : ""}`}
                style={{ padding: 14, textAlign: "center", cursor: "pointer" }}
                onClick={() => form.setFieldValue("user_type", "staff")}
              >
                <TeamOutlined style={{ fontSize: 20, color: "#4f46e5" }} />
                <div style={{ fontWeight: 700, marginTop: 6 }}>Staff</div>
              </div>
            </div>

            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input size="large" prefix={<MailOutlined />} placeholder="you@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
            </Form.Item>
            <Button htmlType="submit" type="primary" block loading={loading} size="large">
              Sign In
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};
