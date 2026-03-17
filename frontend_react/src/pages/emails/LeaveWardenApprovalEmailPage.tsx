import { Card, Typography } from "antd";
import { AppShell } from "../../layouts/AppShell";

export const LeaveWardenApprovalEmailPage = () => (
  <AppShell title="Email Template: Warden Approval">
    <Card className="portal-card">
      <Typography.Title level={4}>Leave Request Approved by Warden</Typography.Title>
      <Typography.Paragraph>
        Dear Student, your leave request has been approved by the warden. Your digital pass is now active.
      </Typography.Paragraph>
    </Card>
  </AppShell>
);
