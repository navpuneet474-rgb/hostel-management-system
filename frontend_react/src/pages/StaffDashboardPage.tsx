import { useEffect, useState } from "react";
import { Button, Card, Col, List, Modal, Row, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AlertOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { AppShell } from "../layouts/AppShell";
import {
  approveRequest,
  getDailySummary,
  getStaffDashboard,
  getStudentsPresentDetails,
  rejectRequest,
} from "../api/endpoints";

interface RequestItem {
  id?: number;
  request_id?: string;
  student__name?: string;
  guest_name?: string;
  status?: string;
}

export const StaffDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [guestRequests, setGuestRequests] = useState<RequestItem[]>([]);
  const [dailySummary, setDailySummary] = useState<Record<string, unknown> | null>(null);
  const [presentStudents, setPresentStudents] = useState<Record<string, unknown>[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await getStaffDashboard();
      const data = result.data || {};
      setStats(data.stats || {});
      setGuestRequests(data.pending_requests?.guest_requests || []);
    } catch {
      message.error("Unable to load staff dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadDailySummary = async () => {
    try {
      const result = await getDailySummary();
      setDailySummary(result);
      setSummaryOpen(true);
    } catch {
      message.error("Unable to load daily summary");
    }
  };

  const loadPresentStudents = async () => {
    try {
      const result = await getStudentsPresentDetails();
      const list = result.data?.students || result.data || [];
      setPresentStudents(Array.isArray(list) ? list : []);
      setPresentOpen(true);
    } catch {
      message.error("Unable to load present students details");
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleAction = async (item: RequestItem, action: "approve" | "reject") => {
    const payload = { request_id: item.request_id || item.id, request_type: "guest" };
    if (action === "approve") {
      await approveRequest(payload);
      message.success("Request approved");
    } else {
      await rejectRequest(payload);
      message.info("Request rejected");
    }
    void loadDashboard();
  };

  const columns: ColumnsType<RequestItem> = [
    { title: "Guest", dataIndex: "guest_name" },
    { title: "Student", dataIndex: "student__name" },
    { title: "Status", dataIndex: "status", render: (value) => <Tag>{value || "pending"}</Tag> },
    {
      title: "Action",
      render: (_, row) => (
        <Row gutter={8}>
          <Col><Button size="small" type="primary" onClick={() => void handleAction(row, "approve")}>Approve</Button></Col>
          <Col><Button size="small" danger onClick={() => void handleAction(row, "reject")}>Reject</Button></Col>
        </Row>
      ),
    },
  ];

  return (
    <AppShell title="Staff Dashboard">
      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Staff Dashboard</Typography.Title>
        <Typography.Text type="secondary">Review pending approvals, monitor occupancy, and track daily activity.</Typography.Text>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={6}><Card className="portal-card"><Statistic title="Pending" prefix={<AlertOutlined />} value={stats.total_pending_requests || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Present" prefix={<CheckCircleOutlined />} value={stats.present_students || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Students" prefix={<TeamOutlined />} value={stats.total_students || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Guests" prefix={<UsergroupAddOutlined />} value={stats.active_guests || 0} /></Card></Col>
      </Row>

      <Card
        className="portal-card"
        style={{ marginTop: 16 }}
        title="Guest Requests"
        extra={
          <Row gutter={8}>
            <Col><Button onClick={() => void loadPresentStudents()}>Present Students</Button></Col>
            <Col><Button onClick={() => void loadDailySummary()}>Daily Summary</Button></Col>
            <Col><Button onClick={() => void loadDashboard()} loading={loading}>Refresh</Button></Col>
          </Row>
        }
      >
        <Table columns={columns} dataSource={guestRequests} rowKey={(r) => String(r.request_id || r.id)} loading={loading} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card className="portal-card" title="Daily Summary Snapshot">
            {dailySummary ? (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(dailySummary, null, 2)}</pre>
            ) : (
              <Typography.Text type="secondary">Load summary to view latest report.</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card className="portal-card" title="Present Students Preview">
            <List
              dataSource={presentStudents.slice(0, 8)}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={(item.name as string) || "Unknown"}
                    description={`${(item.student_id as string) || "N/A"} · Room ${(item.room_number as string) || "N/A"}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal open={summaryOpen} onCancel={() => setSummaryOpen(false)} footer={null} title="Daily Summary">
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(dailySummary, null, 2)}</pre>
      </Modal>

      <Modal open={presentOpen} onCancel={() => setPresentOpen(false)} footer={null} title="Present Students">
        <List
          dataSource={presentStudents}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={(item.name as string) || "Unknown"}
                description={`${(item.student_id as string) || "N/A"} · Room ${(item.room_number as string) || "N/A"}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </AppShell>
  );
};
