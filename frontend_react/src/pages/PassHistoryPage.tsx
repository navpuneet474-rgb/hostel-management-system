import { useEffect, useState } from "react";
import { Button, Card, DatePicker, Form, Input, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { AppShell } from "../layouts/AppShell";
import { getPassHistory } from "../api/endpoints";

interface HistoryItem {
  id?: string;
  type?: string;
  student_name?: string;
  room_number?: string;
  pass_number?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  approved_by?: string;
  created_at?: string;
}

export const PassHistoryPage = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryItem[]>([]);

  const loadHistory = async (filters?: Record<string, string>) => {
    setLoading(true);
    try {
      const result = await getPassHistory(filters);
      setRecords(result.history || []);
    } catch {
      message.error("Unable to load pass history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const columns: ColumnsType<HistoryItem> = [
    { title: "Type", dataIndex: "type", render: (value) => <Tag color={value === "digital_pass" ? "blue" : "purple"}>{value}</Tag> },
    { title: "Student", dataIndex: "student_name" },
    { title: "Room", dataIndex: "room_number" },
    { title: "Pass #", dataIndex: "pass_number" },
    { title: "From", dataIndex: "from_date" },
    { title: "To", dataIndex: "to_date" },
    { title: "Status", dataIndex: "status", render: (value) => <Tag>{value}</Tag> },
    { title: "Approved By", dataIndex: "approved_by" },
    { title: "Created", dataIndex: "created_at" },
  ];

  return (
    <AppShell title="Pass History">
      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Pass History</Typography.Title>
        <Typography.Text type="secondary">View, filter, and export pass records for audits.</Typography.Text>
      </Card>

      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Space size={40}>
          <Statistic title="Total Records" value={records.length} />
          <div>
            <Typography.Text type="secondary">Last Updated</Typography.Text>
            <div style={{ fontWeight: 700 }}>{new Date().toLocaleString()}</div>
          </div>
        </Space>
      </Card>

      <Card className="portal-card">
        <Form
          layout="inline"
          onFinish={(values) => {
            const payload: Record<string, string> = {};
            if (values.student_name) payload.student_name = values.student_name;
            if (values.pass_type) payload.pass_type = values.pass_type;
            if (values.status) payload.status = values.status;
            if (values.start_date) payload.start_date = dayjs(values.start_date).format("YYYY-MM-DD");
            if (values.end_date) payload.end_date = dayjs(values.end_date).format("YYYY-MM-DD");
            void loadHistory(payload);
          }}
        >
          <Form.Item name="start_date"><DatePicker placeholder="Start" /></Form.Item>
          <Form.Item name="end_date"><DatePicker placeholder="End" /></Form.Item>
          <Form.Item name="student_name"><Input placeholder="Student" /></Form.Item>
          <Form.Item name="pass_type"><Select allowClear placeholder="Type" style={{ width: 120 }} options={[{ value: "digital", label: "Digital" }, { value: "leave", label: "Leave" }]} /></Form.Item>
          <Form.Item name="status"><Select allowClear placeholder="Status" style={{ width: 130 }} options={[{ value: "approved" }, { value: "pending" }, { value: "rejected" }, { value: "active" }, { value: "expired" }]} /></Form.Item>
          <Space>
            <Button htmlType="submit" type="primary">Apply</Button>
            <Button onClick={() => void loadHistory()}>Reset</Button>
            <Button href="/api/pass-history/export/" target="_blank">Export CSV</Button>
          </Space>
        </Form>
      </Card>

      <Card className="portal-card" style={{ marginTop: 16 }}>
        <Table rowKey={(r) => r.id || r.pass_number || Math.random().toString()} columns={columns} dataSource={records} loading={loading} />
      </Card>
    </AppShell>
  );
};
