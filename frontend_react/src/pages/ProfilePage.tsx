import { Avatar, Button, Card, Col, Descriptions, Row, Space, Tag, Typography } from "antd";
import { IdcardOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../layouts/AppShell";

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <AppShell title="My Profile">
      <Card className="glass-card" style={{ borderRadius: 20 }}>
        <Space align="start" size={20}>
          <Avatar size={92} icon={<UserOutlined />} style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }} />
          <div>
            <Typography.Title level={3} style={{ marginTop: 0 }}>{user?.name || "User"}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              <MailOutlined style={{ marginRight: 6 }} />
              {user?.email || "No email"}
            </Typography.Paragraph>
            <Tag color="blue">{user?.userType || "unknown"}</Tag>
            <Button href="/auth/change-password/" type="primary">Change Password</Button>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card style={{ borderRadius: 16 }}>
            <Typography.Title level={5}>Identity</Typography.Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="User ID">
                <IdcardOutlined style={{ marginRight: 6 }} />
                {user?.id || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Role">{user?.userType || "-"}</Descriptions.Item>
              <Descriptions.Item label="Email">{user?.email || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{ borderRadius: 16 }}>
            <Typography.Title level={5}>Quick Actions</Typography.Title>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block href="/student/dashboard">Go to Dashboard</Button>
              <Button block href="/auth/change-password/" type="primary">Update Password</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16, borderRadius: 16 }}>
        <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
          This profile page now mirrors the legacy rich card presentation while staying React-driven.
        </Typography.Paragraph>
      </Card>
    </AppShell>
  );
};
