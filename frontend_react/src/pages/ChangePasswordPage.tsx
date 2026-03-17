import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography, message } from "antd";
import { KeyOutlined } from "@ant-design/icons";
import { changePassword } from "../api/endpoints";

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
  mobile_number?: string;
  roll_number?: string;
}

export const ChangePasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onFinish = async (values: PasswordForm) => {
    if (values.new_password !== values.confirm_password) {
      setError("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await changePassword(values as unknown as Record<string, string>);
      if (!result.success) {
        setError(result.error || "Password update failed");
        return;
      }
      message.success(result.message || "Password changed");
    } catch {
      setError("Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen flex items-center justify-center p-4">
      <div className="auth-float" style={{ top: 80, left: 70, width: 110, height: 110 }} />
      <div className="auth-float delay" style={{ bottom: 100, right: 90, width: 125, height: 125 }} />
      <Card className="auth-glass-card" style={{ width: 540, zIndex: 1 }} bodyStyle={{ padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#eef2ff",
              color: "#4f46e5",
              margin: "0 auto 10px auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            <KeyOutlined />
          </div>
          <Typography.Title level={3} style={{ marginBottom: 6 }}>Change Password</Typography.Title>
          <Typography.Text type="secondary">Update credentials and profile contact details.</Typography.Text>
        </div>

        {error && <Alert showIcon type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Current Password" name="current_password" rules={[{ required: true }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item label="New Password" name="new_password" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item label="Confirm Password" name="confirm_password" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item label="Mobile Number" name="mobile_number">
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Roll Number" name="roll_number">
            <Input size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
};
