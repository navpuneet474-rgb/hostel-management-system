import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { AppShell } from "../layouts/AppShell";
import {
  getStudentDashboardData,
  submitGuestRequest,
  submitLeaveRequest,
  submitMaintenanceRequest,
} from "../api/endpoints";

interface ItemRecord {
  id?: number;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export const StudentDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [passes, setPasses] = useState<ItemRecord[]>([]);
  const [guests, setGuests] = useState<ItemRecord[]>([]);
  const [maintenance, setMaintenance] = useState<ItemRecord[]>([]);
  const [isLeaveOpen, setLeaveOpen] = useState(false);
  const [isGuestOpen, setGuestOpen] = useState(false);
  const [isMaintenanceOpen, setMaintenanceOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getStudentDashboardData();
      setPasses(data.passes?.results || data.passes || []);
      setGuests(data.guests?.results || data.guests || []);
      setMaintenance(data.maintenance?.results || data.maintenance || []);
    } catch {
      message.error("Unable to load student dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <AppShell title="Student Dashboard">
      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Welcome Back</Typography.Title>
        <Typography.Text type="secondary">Student Portal with quick hostel actions and request tracking.</Typography.Text>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="quick-action" hoverable>
            <CommentOutlined style={{ color: "#2563eb", fontSize: 20 }} />
            <div style={{ fontWeight: 700, marginTop: 8 }}>AI Assistant</div>
            <Typography.Text type="secondary">Get instant help</Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="quick-action" hoverable onClick={() => setLeaveOpen(true)}>
            <CalendarOutlined style={{ color: "#16a34a", fontSize: 20 }} />
            <div style={{ fontWeight: 700, marginTop: 8 }}>Leave Request</div>
            <Typography.Text type="secondary">Apply for leave</Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="quick-action" hoverable>
            <UserOutlined style={{ color: "#7c3aed", fontSize: 20 }} />
            <div style={{ fontWeight: 700, marginTop: 8 }}>My Profile</div>
            <Typography.Text type="secondary">View details</Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="quick-action" hoverable onClick={() => setMaintenanceOpen(true)}>
            <ToolOutlined style={{ color: "#ea580c", fontSize: 20 }} />
            <div style={{ fontWeight: 700, marginTop: 8 }}>Maintenance</div>
            <Typography.Text type="secondary">Report issues</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card><Statistic title="Active Passes" value={passes.length} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Guest Requests" value={guests.length} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Maintenance Tickets" value={maintenance.length} /></Card>
        </Col>
      </Row>

      <Card className="portal-card" style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" onClick={() => setLeaveOpen(true)}>New Leave Request</Button>
          <Button onClick={() => setGuestOpen(true)}>New Guest Request</Button>
          <Button onClick={() => setMaintenanceOpen(true)}>New Maintenance</Button>
          <Button onClick={() => void loadData()} loading={loading}>Refresh</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card className="portal-card" title="Guest Requests" extra={<Button size="small" onClick={() => setGuestOpen(true)}>New</Button>}>
            <List
              loading={loading}
              dataSource={guests}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={(item.guest_name as string) || `Request #${String(item.id || "")}`}
                    description={`Status: ${String(item.status || "pending")} · ${String(item.created_at || "")}`}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card className="portal-card" style={{ marginTop: 16 }} title="Maintenance Requests" extra={<Button size="small" onClick={() => setMaintenanceOpen(true)}>New</Button>}>
            <List
              loading={loading}
              dataSource={maintenance}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={(item.issue_type as string) || `Ticket #${String(item.id || "")}`}
                    description={`Status: ${String(item.status || "pending")} · ${String(item.created_at || "")}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="portal-card" title="Active Passes" extra={<CheckCircleOutlined style={{ color: "#16a34a" }} />}>
            <List
              loading={loading}
              dataSource={passes}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>{String(item.pass_number || `Pass #${String(item.id || "")}`)}</Typography.Text>
                    <Tag color="green">{String(item.status || "active")}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          <Card className="portal-card" style={{ marginTop: 16 }} title="Student Information">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Student ID">Session User</Descriptions.Item>
              <Descriptions.Item label="Room">Configured in backend session</Descriptions.Item>
              <Descriptions.Item label="Email">Available from login context</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Modal title="Submit Leave Request" open={isLeaveOpen} footer={null} onCancel={() => setLeaveOpen(false)}>
        <Form layout="vertical" onFinish={async (values: Record<string, unknown>) => { await submitLeaveRequest(values); message.success("Leave request submitted"); setLeaveOpen(false); void loadData(); }}>
          <Form.Item name="from_date" label="From" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="to_date" label="To" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Button htmlType="submit" type="primary" block>Submit</Button>
        </Form>
      </Modal>

      <Modal title="Submit Guest Request" open={isGuestOpen} footer={null} onCancel={() => setGuestOpen(false)}>
        <Form layout="vertical" onFinish={async (values: Record<string, unknown>) => { await submitGuestRequest(values); message.success("Guest request submitted"); setGuestOpen(false); void loadData(); }}>
          <Form.Item name="guest_name" label="Guest Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="relationship" label="Relationship" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="purpose" label="Purpose" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Button htmlType="submit" type="primary" block>Submit</Button>
        </Form>
      </Modal>

      <Modal title="Submit Maintenance Request" open={isMaintenanceOpen} footer={null} onCancel={() => setMaintenanceOpen(false)}>
        <Form layout="vertical" onFinish={async (values: Record<string, unknown>) => { await submitMaintenanceRequest(values); message.success("Maintenance request submitted"); setMaintenanceOpen(false); void loadData(); }}>
          <Form.Item name="issue_type" label="Issue Type" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Button htmlType="submit" type="primary" block>Submit</Button>
        </Form>
      </Modal>
    </AppShell>
  );
};
