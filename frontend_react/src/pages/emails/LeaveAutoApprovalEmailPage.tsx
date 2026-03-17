import { Card, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const LeaveAutoApprovalEmailPage = () => (
  <AppShell title="Email Template: Auto Approval">
    <Card className="portal-card">
      <Typography.Title level={4}>Leave Auto-Approved</Typography.Title>
      <Typography.Paragraph>
        Your leave request met auto-approval rules and has been approved automatically.
      </Typography.Paragraph>
    </Card>
  </AppShell>
);
