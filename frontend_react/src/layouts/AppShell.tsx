import { Layout, Menu, Typography } from "antd";
import {
  DashboardOutlined,
  MessageOutlined,
  HistoryOutlined,
  SearchOutlined,
  SafetyOutlined,
  ToolOutlined,
  UserOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const { Header, Sider, Content } = Layout;

const items = [
  { key: "/student/dashboard", icon: <DashboardOutlined />, label: <Link to="/student/dashboard">Student</Link> },
  { key: "/staff", icon: <DashboardOutlined />, label: <Link to="/staff">Staff</Link> },
  { key: "/chat", icon: <MessageOutlined />, label: <Link to="/chat">AI Chat</Link> },
  { key: "/staff/pass-history", icon: <HistoryOutlined />, label: <Link to="/staff/pass-history">Pass History</Link> },
  { key: "/staff/query", icon: <SearchOutlined />, label: <Link to="/staff/query">Staff Query</Link> },
  { key: "/security/dashboard", icon: <SafetyOutlined />, label: <Link to="/security/dashboard">Security</Link> },
  { key: "/maintenance/dashboard", icon: <ToolOutlined />, label: <Link to="/maintenance/dashboard">Maintenance</Link> },
  { key: "/student/profile", icon: <UserOutlined />, label: <Link to="/student/profile">Profile</Link> },
  { key: "/auth/change-password", icon: <KeyOutlined />, label: <Link to="/auth/change-password">Change Password</Link> },
];

export const AppShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0" width={250} theme="light">
        <div style={{ padding: 18 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Hostel React
          </Typography.Title>
        </div>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "0 20px" }}>
          <Typography.Title level={4} style={{ margin: "14px 0" }}>
            {title}
          </Typography.Title>
        </Header>
        <Content style={{ padding: 20 }}>
          <div className="page-shell">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
};
