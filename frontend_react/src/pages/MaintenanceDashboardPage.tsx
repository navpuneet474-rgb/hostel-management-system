import { useEffect, useState } from "react";
import { Button, Card, Col, Form, Input, Row, Select, Statistic, Table, Typography, message } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, FireOutlined, ToolOutlined } from "@ant-design/icons";
import { AppShell } from "../layouts/AppShell";
import {
  acceptMaintenanceTask,
  getMaintenanceHistory,
  getMaintenanceStats,
  updateMaintenanceStatus,
} from "../api/endpoints";

export const MaintenanceDashboardPage = () => {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);

  const load = async () => {
    try {
      const [statsResult, historyResult] = await Promise.all([getMaintenanceStats(), getMaintenanceHistory()]);
      setStats(statsResult.stats || statsResult || {});
      setHistory(historyResult.history || historyResult.results || []);
    } catch {
      message.error("Unable to load maintenance dashboard");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell title="Maintenance Dashboard">
      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Maintenance Operations</Typography.Title>
        <Typography.Text type="secondary">Track task load, claim work, and update progress in real-time.</Typography.Text>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={6}><Card className="portal-card"><Statistic title="Open" prefix={<ClockCircleOutlined />} value={stats.open_requests || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="In Progress" prefix={<ToolOutlined />} value={stats.in_progress || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Completed" prefix={<CheckCircleOutlined />} value={stats.completed || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="High Priority" prefix={<FireOutlined />} value={stats.high_priority || 0} /></Card></Col>
      </Row>

      <Card className="portal-card" style={{ marginTop: 16 }} title="Update Task Status">
        <Form
          layout="inline"
          onFinish={async (values) => {
            await updateMaintenanceStatus(values);
            message.success("Task updated");
            void load();
          }}
        >
          <Form.Item name="request_id" rules={[{ required: true }]}><Input placeholder="Request ID" /></Form.Item>
          <Form.Item name="status" rules={[{ required: true }]}>
            <Select style={{ width: 180 }} options={[{ value: "assigned" }, { value: "in_progress" }, { value: "resolved" }, { value: "closed" }]} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Update</Button>
          <Button
            onClick={async () => {
              const requestId = (document.querySelector("input[placeholder='Request ID']") as HTMLInputElement)?.value;
              if (!requestId) {
                message.warning("Enter Request ID first");
                return;
              }
              await acceptMaintenanceTask({ request_id: requestId });
              message.success("Task accepted");
              void load();
            }}
          >
            Accept Task
          </Button>
        </Form>
      </Card>

      <Card className="portal-card" style={{ marginTop: 16 }} title="Maintenance History">
        <Table
          dataSource={history}
          rowKey={(r) => String(r.id || Math.random())}
          columns={[
            { title: "ID", dataIndex: "id" },
            { title: "Title", dataIndex: "title" },
            { title: "Priority", dataIndex: "priority" },
            { title: "Status", dataIndex: "status" },
            { title: "Updated", dataIndex: "updated_at" },
          ]}
        />
      </Card>
    </AppShell>
  );
};
