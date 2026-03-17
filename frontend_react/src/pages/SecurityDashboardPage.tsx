import { useEffect, useState } from "react";
import { Button, Card, Col, Form, Input, Row, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { ExportOutlined, SafetyCertificateOutlined, SearchOutlined } from "@ant-design/icons";
import { AppShell } from "../layouts/AppShell";
import {
  activateEmergencyMode,
  bulkVerifyPasses,
  getRecentVerifications,
  getSecurityActivePasses,
  getSecurityStats,
  searchStudentPasses,
  verifyPass,
} from "../api/endpoints";

export const SecurityDashboardPage = () => {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activePasses, setActivePasses] = useState<Record<string, unknown>[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<Record<string, unknown>[]>([]);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    try {
      const result = await getSecurityStats();
      setStats(result.stats || result || {});
      const activeResult = await getSecurityActivePasses();
      const recentResult = await getRecentVerifications();
      setActivePasses(activeResult.active_passes || []);
      setRecentVerifications(recentResult.recent_verifications || []);
    } catch {
      message.error("Unable to load security stats");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell title="Security Dashboard">
      <Card className="portal-card" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Security Dashboard</Typography.Title>
        <Typography.Text type="secondary">Gate verification, student search, and emergency controls.</Typography.Text>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={6}><Card className="portal-card"><Statistic title="Active Passes" value={stats.active_passes || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Students Away" value={stats.students_away || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Active Guests" value={stats.active_guests || 0} /></Card></Col>
        <Col span={6}><Card className="portal-card"><Statistic title="Verifications" value={stats.total_verifications || 0} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card className="portal-card" title="Verify Digital Pass" extra={<SafetyCertificateOutlined style={{ color: "#16a34a" }} />}>
        <Form layout="inline" onFinish={async (values) => {
          setVerifying(true);
          try {
            const result = await verifyPass(values.pass_number);
            message.success(result.message || result.status || "Verified");
            void load();
          } catch {
            message.error("Verification failed");
          } finally {
            setVerifying(false);
          }
        }}>
          <Form.Item name="pass_number" rules={[{ required: true }]}><Input placeholder="LP-2026..." /></Form.Item>
          <Button htmlType="submit" type="primary" loading={verifying}>Verify</Button>
          <Button
            onClick={async () => {
              try {
                const values = (document.querySelector("input[placeholder='LP-2026...']") as HTMLInputElement)?.value || "";
                const passNumbers = values.split(",").map((v) => v.trim()).filter(Boolean);
                if (!passNumbers.length) {
                  message.warning("Enter comma-separated pass numbers in verify field first");
                  return;
                }
                await bulkVerifyPasses(passNumbers);
                message.success("Bulk verification completed");
                void load();
              } catch {
                message.error("Bulk verification failed");
              }
            }}
          >
            Bulk Verify
          </Button>
          <Button
            danger
            onClick={async () => {
              try {
                await activateEmergencyMode({
                  emergency_type: "general_emergency",
                  description: "Activated from React dashboard",
                  activated_by: "Security Personnel",
                });
                message.success("Emergency mode activated");
              } catch {
                message.error("Emergency activation failed");
              }
            }}
          >
            Emergency Mode
          </Button>
          <Button href="/api/security/export-report/" target="_blank" icon={<ExportOutlined />}>Export Report</Button>
        </Form>
          </Card>

          <Card className="portal-card" style={{ marginTop: 16 }} title="Search Student Passes" extra={<SearchOutlined />}>
            <Form
              layout="inline"
              onFinish={async (values) => {
                try {
                  const result = await searchStudentPasses(values.query);
                  setSearchResults(result.students || []);
                } catch {
                  message.error("Search failed");
                }
              }}
            >
              <Form.Item name="query" rules={[{ required: true }]}><Input placeholder="Student name or ID" /></Form.Item>
              <Button htmlType="submit">Search</Button>
            </Form>
            <Table
              style={{ marginTop: 12 }}
              dataSource={searchResults}
              rowKey={(r) => String(r.student_id || Math.random())}
              pagination={false}
              columns={[
                { title: "Student", dataIndex: "name" },
                { title: "ID", dataIndex: "student_id" },
                { title: "Room", dataIndex: "room_number" },
                { title: "Has Active Pass", dataIndex: "has_active_pass", render: (v) => <Tag color={v ? "green" : "default"}>{String(v)}</Tag> },
              ]}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card className="portal-card" title="Recent Verifications">
            <Table
              dataSource={recentVerifications}
              rowKey={(r) => `${String(r.student_id || "unknown")}-${String(r.verification_time || Math.random())}`}
              pagination={false}
              columns={[
                { title: "Student", dataIndex: "student_name" },
                { title: "Pass", dataIndex: "pass_number" },
                { title: "Status", dataIndex: "status", render: (v) => <Tag>{v}</Tag> },
                { title: "Time", dataIndex: "verification_time" },
              ]}
              size="small"
            />
          </Card>

          <Card className="portal-card" style={{ marginTop: 16 }} title="Active Passes">
            <Table
              dataSource={activePasses}
              rowKey={(r) => String(r.pass_number || Math.random())}
              columns={[
                { title: "Pass", dataIndex: "pass_number" },
                { title: "Student", dataIndex: "student_name" },
                { title: "Status", dataIndex: "status", render: (v) => <Tag>{v}</Tag> },
                { title: "Valid Till", dataIndex: "to_date" },
              ]}
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>
    </AppShell>
  );
};
