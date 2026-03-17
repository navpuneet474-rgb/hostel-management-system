import { Card, Descriptions, Tag, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const DigitalPassTemplatePage = () => {
  return (
    <AppShell title="Digital Pass Template">
      <Card className="portal-card">
        <Typography.Title level={3}>Digital Leave Pass</Typography.Title>
        <Typography.Paragraph type="secondary">
          React equivalent of the legacy printable digital pass template.
        </Typography.Paragraph>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Pass Number">LP-2026-0001</Descriptions.Item>
          <Descriptions.Item label="Student">Sample Student</Descriptions.Item>
          <Descriptions.Item label="Student ID">STU001</Descriptions.Item>
          <Descriptions.Item label="Room">101, Block A</Descriptions.Item>
          <Descriptions.Item label="From">2026-03-18</Descriptions.Item>
          <Descriptions.Item label="To">2026-03-20</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color="green">Approved</Tag></Descriptions.Item>
          <Descriptions.Item label="Verification Code">VER-ABC-123</Descriptions.Item>
        </Descriptions>
      </Card>
    </AppShell>
  );
};
